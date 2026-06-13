import { useCallback } from 'react';
import { chatComplete, type ChatContent } from '@/api/chat';
import { generateImage } from '@/api/images';
import { requestStructuredJson } from '@/api/structured';
import {
  fetchImageMaterialBlob,
  importImageUrlMaterial,
  uploadImageMaterial,
  uploadMaterial,
} from '@/api/media';
import { mjImagine, splitMjGrid } from '@/api/midjourney';
import { getModelDef } from '@/api/models';
import { routeRequest } from '@/api/model-routing';
import { buildSeedanceVideoVars, isSeedanceVideoModel } from '@/api/seedance';
import type { Vars } from '@/api/template';
import { FIXED_BASE_URL, normalizeImageModelId } from '@/api/upstream';
import {
  buildVideoRequest,
  type GenerateVideoOpts,
} from '@/api/videos';
import {
  getVideoTaskClientId,
  submitBackgroundVideoTask,
  waitForBackgroundVideoTask,
} from '@/api/video-tasks';
import {
  FEATURE_DISABLED_MESSAGE,
  isNodeFeatureEnabled,
} from '@/config/features';
import { useCanvas } from '@/store/canvas';
import { useHistory, type HistoryEntry, type HistoryKind } from '@/store/history';
import { useLibrary } from '@/store/library';
import { getPref } from '@/store/prefs';
import { useTasks } from '@/store/tasks';
import type { AppEdge } from '@/types/edge';
import type {
  AppNode,
  CharacterCardNode,
  ExtractCharactersScenesNode,
  ExpressionType,
  GenerateCharacterImageNode,
  GenerateCharacterVideoNode,
  GenerateSceneImageNode,
  GenerateSceneVideoNode,
  GenImageNode,
  GenVideoNode,
  DirectFinalAnalysisNode,
  DirectFinalDetailPromptNode,
  DirectFinalMainPromptNode,
  DirectFinalRenderNode,
  DirectFinalReviewNode,
  NodeId,
  NodeKind,
  VideoAnalyzeNode,
} from '@/types/node';
import type { ModelDef } from '@/types/model';
import { splitImageBatch } from '@/utils/batch';
import { blobToDataURL, urlToBlob } from '@/utils/image';
import { edgeId } from '@/utils/id';
import { createImageCompareNode, createNode, createVideoPreviewNode } from '@/canvas/factory';
import { getResultNodePosition } from '@/canvas/resultLayout';
import { composeCharacterCard } from '@/utils/characterCard';
import { resolveUpstream } from './useUpstream';
import { resolveProviderConfig } from '@/utils/providerConfig';
import { collectDirectFinalGraphContext } from '@/lib/direct-final/graph';
import {
  buildAssetInputText,
  buildAssetInstructions,
  buildCommercialBriefInputText,
  buildCommercialBriefInstructions,
  buildDirectFinalExecutionPrompt,
  buildReviewInputText,
  buildReviewInstructions,
  buildSellingReasonInputText,
  buildSellingReasonInstructions,
} from '@/lib/direct-final/prompts';
import {
  COMMERCIAL_BRIEF_SCHEMA,
  DIRECT_FINAL_ASSET_SCHEMA,
  DIRECT_FINAL_REVIEW_SCHEMA,
  SELLING_REASON_SCHEMA,
  buildRiskSummary,
  createAssetFromPayload,
  createCommercialBriefFromPayload,
  createReviewFromPayload,
  createSellingReasonCardsFromPayload,
} from '@/lib/direct-final/validation';
import { evaluateDirectFinalAsset } from '@/lib/direct-final/review';

export interface TriggerResult {
  taskId: string;
}

type PatchFn = (id: NodeId, p: { content: string }) => void;

function imageResultToUrl(item: { url?: string; b64_json?: string }): string | undefined {
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return undefined;
}

async function persistImageUrl(url: string, name: string): Promise<string> {
  try {
    if (isLocalImageUrl(url)) {
      const blob = await loadImageBlob(url);
      return uploadImageMaterial(blob, ensureImageFilename(name, blob.type));
    }
    if (isHttpUrl(url)) {
      // 对于 HTTP URL，直接让后端导入
      // 避免浏览器 CORS 问题
      return importImageUrlMaterial(url, ensureImageFilename(name));
    }
  } catch (error) {
    if (isStorageNotConfiguredError(error)) return url;
    throw error;
  }
  throw new Error(`不支持的图片地址: ${url.slice(0, 48)}`);
}

async function persistImageUrls(urls: string[], prefix: string): Promise<string[]> {
  return Promise.all(urls.map((url, index) => persistImageUrl(url, `${prefix}-${index + 1}`)));
}

interface MediaRuntime {
  baseUrl?: string;
  apiKey?: string;
}

async function persistMediaUrl(
  url: string,
  name: string,
  runtime: MediaRuntime = {},
): Promise<string> {
  if (isLocalImageUrl(url)) {
    const blob = await loadImageBlob(url);
    return uploadMaterial(blob, ensureMediaFilename(name, blob.type), runtime);
  }
  if (isHttpUrl(url)) return url;
  throw new Error(`不支持的素材地址: ${url.slice(0, 48)}`);
}

async function prepareAudioUrls(
  urls: string[],
  runtime: MediaRuntime = {},
): Promise<string[]> {
  return Promise.all(
    urls.filter(Boolean).map((url, index) => persistMediaUrl(url, `audio-${index + 1}`, runtime)),
  );
}

async function loadImageBlob(url: string): Promise<Blob> {
  if (isHttpUrl(url)) return fetchImageMaterialBlob(url);
  return urlToBlob(url);
}

async function prepareReferenceInputs(
  urls: string[],
  options: { includeBlobs: boolean },
): Promise<{ imageUrls: string[]; blobs?: Blob[] }> {
  const imageUrls = await prepareReferenceImageUrls(urls);
  if (!options.includeBlobs) return { imageUrls };
  return {
    imageUrls,
    blobs: await Promise.all(imageUrls.map(loadImageBlob)),
  };
}

function isLocalImageUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:');
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function isStorageNotConfiguredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('storage_not_configured');
}

function ensureImageFilename(name: string, contentType = 'image/png'): string {
  if (/\.[a-z0-9]{1,8}$/i.test(name)) return name;
  return `${name}${extensionFromContentType(contentType)}`;
}

function ensureMediaFilename(name: string, contentType = 'application/octet-stream'): string {
  if (/\.[a-z0-9]{1,8}$/i.test(name)) return name;
  return `${name}${extensionFromContentType(contentType)}`;
}

function extensionFromContentType(contentType: string): string {
  const type = contentType.toLowerCase().split(';')[0].trim();
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  if (type === 'audio/mpeg') return '.mp3';
  if (type === 'audio/wav' || type === 'audio/wave' || type === 'audio/x-wav') return '.wav';
  if (type === 'audio/ogg') return '.ogg';
  if (type === 'audio/aac') return '.aac';
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return '.m4a';
  if (type === 'video/mp4') return '.mp4';
  return '.png';
}

function resolveImageSize(settings: {
  resolution?: string;
  width?: number | '';
  height?: number | '';
}): string {
  const width = clampImageDimension(settings.width);
  const height = clampImageDimension(settings.height);
  if (width && height) return `${width}x${height}`;
  return settings.resolution ?? '1024x1024';
}

function resolveVideoSizeForModel(
  modelId: string,
  ratio?: string,
  resolution?: string,
): string | undefined {
  if (isKlingVideoModel(modelId)) return ratioToKlingSize(ratio);
  if (isSeedanceVideoModel(modelId)) return ratioToKlingSize(ratio);
  if (isHappyHorseVideoModel(modelId)) return undefined;
  return resolution || '720p';
}

function resolveVideoResolutionForModel(modelId: string, resolution?: string): string {
  const value = normalizeVideoResolution(resolution);
  return isHappyHorseVideoModel(modelId) ? normalizeHappyHorseResolution(value) : value;
}

function happyHorseMetadataForModel(
  modelId: string,
  ratio?: string,
  resolution?: string,
): Record<string, unknown> | undefined {
  if (!isHappyHorseVideoModel(modelId)) return undefined;
  const parameters: Record<string, unknown> = {
    resolution: normalizeHappyHorseResolution(resolution),
  };
  if (isHappyHorseRatioModel(modelId)) {
    parameters.ratio = resolveVideoRatio(ratio);
  }
  return { parameters };
}

function mergeVideoMetadata(
  base: unknown,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!patch)
    return base && typeof base === 'object' && !Array.isArray(base)
      ? { ...(base as Record<string, unknown>) }
      : undefined;
  if (!base || typeof base !== 'object' || Array.isArray(base)) return patch;
  return { ...(base as Record<string, unknown>), ...patch };
}

function audioReferenceMetadata(audioUrls: string[]): Record<string, unknown> | undefined {
  if (audioUrls.length === 0) return undefined;
  return {
    audio_urls: audioUrls,
    reference_audio_urls: audioUrls,
    audio_url: audioUrls[0],
  };
}

function isHappyHorseVideoModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('happyhorse-1.0-');
}

function isHappyHorseTextToVideoModel(modelId: string): boolean {
  return modelId.toLowerCase() === 'happyhorse-1.0-t2v';
}

function isHappyHorseImageToVideoModel(modelId: string): boolean {
  return modelId.toLowerCase() === 'happyhorse-1.0-i2v';
}

function isHappyHorseReferenceToVideoModel(modelId: string): boolean {
  return modelId.toLowerCase() === 'happyhorse-1.0-r2v';
}

function isHappyHorseRatioModel(modelId: string): boolean {
  const name = modelId.toLowerCase();
  return name === 'happyhorse-1.0-t2v' || name === 'happyhorse-1.0-r2v';
}

function validateHappyHorseVideoInputs(
  modelId: string,
  imageCount: number,
  hasVideoRef: boolean,
  videoMode: 'first-last-frame' | 'omni-reference',
): void {
  if (!isHappyHorseVideoModel(modelId)) return;
  if (videoMode === 'first-last-frame') {
    throw new Error('HappyHorse 不支持首尾帧模式，请切换为全能参考');
  }
  if (isHappyHorseTextToVideoModel(modelId)) {
    if (imageCount > 0 || hasVideoRef) {
      throw new Error('HappyHorse 文生视频不支持参考素材，请断开参考图/视频');
    }
    return;
  }
  if (isHappyHorseImageToVideoModel(modelId)) {
    if (hasVideoRef) {
      throw new Error('HappyHorse 图生视频仅支持 1 张首帧图片，不支持参考视频');
    }
    if (imageCount !== 1) {
      throw new Error('HappyHorse 图生视频需要且仅支持 1 张首帧图片');
    }
    return;
  }
  if (isHappyHorseReferenceToVideoModel(modelId)) {
    if (hasVideoRef) {
      throw new Error('HappyHorse 多图参考仅支持参考图片，不支持参考视频');
    }
    if (imageCount < 1 || imageCount > 9) {
      throw new Error('HappyHorse 多图参考需要 1-9 张参考图片');
    }
  }
}

function normalizeHappyHorseResolution(resolution?: string): string {
  const value = String(resolution || '720p').trim().toUpperCase();
  if (value === '1080' || value === '1080P') return '1080P';
  return '720P';
}

function normalizeVideoResolution(resolution?: string): string {
  const value = String(resolution || '720p').trim().toLowerCase();
  return value === '1080p' || value === '1080' ? '1080p' : '720p';
}

function resolveVideoDuration(modelId: string, duration?: string | number): string {
  const parsed = typeof duration === 'number' ? duration : parseInt(String(duration ?? '5s'), 10);
  const value = Number.isFinite(parsed) ? parsed : 5;
  const isHappyHorse = modelId.toLowerCase().startsWith('happyhorse-1.0-');
  const min = isHappyHorse ? 3 : 4;
  const max = isHappyHorse ? 15 : 10;
  return `${Math.min(max, Math.max(min, value))}s`;
}

function resolveVideoRatio(ratio?: string): string {
  const value = ratio || '16:9';
  if (['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].includes(value)) return value;
  return '16:9';
}

function ratioToKlingSize(ratio = '16:9'): string {
  switch (ratio) {
    case '9:16':
      return '720x1280';
    case '1:1':
      return '1024x1024';
    case '4:3':
      return '1024x768';
    case '3:4':
      return '768x1024';
    case '21:9':
      return '1280x720';
    case '16:9':
    default:
      return '1280x720';
  }
}

function isKlingVideoModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('kling');
}

function isWan27I2VModel(modelId: string): boolean {
  const name = modelId.toLowerCase();
  return name.startsWith('wan2.7') && name.includes('i2v');
}

function wan27MediaMetadata(
  imageUrls: string[],
  videoUrl: string | null,
  mode: 'first-last-frame' | 'omni-reference',
): Record<string, unknown> | undefined {
  const media: Array<{ type: string; url: string }> = [];
  if (mode === 'first-last-frame') {
    if (imageUrls[0]) media.push({ type: 'first_frame', url: imageUrls[0] });
    if (imageUrls[1]) media.push({ type: 'last_frame', url: imageUrls[1] });
  } else {
    if (imageUrls[0]) media.push({ type: 'first_frame', url: imageUrls[0] });
    if (videoUrl) media.push({ type: 'first_clip', url: videoUrl });
  }
  if (media.length === 0) return undefined;
  return { input: { media } };
}

function klingNativeInput(
  prompt: string,
  imageUrls: string[],
  videoUrl: string | null,
  mode: 'first-last-frame' | 'omni-reference',
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };
  const media: Array<Record<string, unknown>> = [];
  if (mode === 'first-last-frame') {
    if (imageUrls[0]) media.push({ type: 'first_frame', url: imageUrls[0] });
    if (imageUrls[1]) media.push({ type: 'last_frame', url: imageUrls[1] });
  } else {
    for (const url of imageUrls) media.push({ type: 'refer', url });
    if (videoUrl) media.push({ type: 'base', url: videoUrl, keep_original_sound: 'yes' });
  }
  if (media.length > 0) input.media = media;
  return input;
}

function klingNativeParameters(
  ratio?: string,
  resolution?: string,
  duration?: string | number,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    aspect_ratio: ratioToKlingAspect(ratio),
    duration: durationToNumber(duration),
    quality: resolution === '1080p' ? 'pro' : 'std',
  };
  return params;
}

function ratioToKlingAspect(ratio = '16:9'): string {
  if (ratio === '9:16' || ratio === '1:1') return ratio;
  if (ratio === '3:4') return '9:16';
  return '16:9';
}

function durationToNumber(duration: string | number | undefined): number {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
  const parsed = parseInt(String(duration ?? '5s'), 10);
  return Number.isNaN(parsed) ? 5 : parsed;
}

function clampImageDimension(value: number | '' | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(Number(value));
  return Math.min(4096, Math.max(64, rounded));
}

function resolveImageQuality(value?: string): string {
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  if (value === 'low') return 'low';
  return 'standard';
}

function clampDirectFinalRenderCount(value: number | undefined): number {
  const parsed = Math.round(Number(value ?? 1));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(9, Math.max(1, parsed));
}

interface RunResult {
  kind: HistoryKind;
  model: string;
  prompt?: string;
  contentUrl?: string;
  contentUrls?: string[];
  sizeDesc?: string;
  refsCount?: number;
}

const IMAGE_RESULT_NODE_KINDS = new Set<NodeKind>([
  'gen-image',
  'generate-character-image',
  'generate-scene-image',
  'character-card',
]);

type HistoryDraft = Omit<HistoryEntry, 'id' | 'timestamp'>;

function loadRuntime(model?: ModelDef): { apiKey: string; baseUrl: string } {
  // 如果提供了模型，尝试从模型的服务商配置中读取
  if (model) {
    const providerConfig = resolveProviderConfig(model);
    if (providerConfig) {
      return {
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
      };
    }
  }

  // 回退到全局配置（兼容旧版本）
  const apiKey = String(getPref('global_key', ''));
  const baseUrl = String(getPref('global_base_url', FIXED_BASE_URL));

  if (!apiKey) {
    throw new Error('API Key 未配置（请在设置中配置服务商或全局 API Key）');
  }
  if (!baseUrl) {
    throw new Error('Base URL 未配置（请在设置中配置服务商 Base URL）');
  }

  return { apiKey, baseUrl };
}

function createPendingHistory(
  node: AppNode,
  nodes: AppNode[],
  edges: AppEdge[],
): HistoryEntry | null {
  const draft = getPendingHistoryDraft(node, nodes, edges);
  if (!draft) return null;
  return useHistory.getState().create({ ...draft, status: 'pending' });
}

async function runVideoViaBackgroundTask(
  opts: GenerateVideoOpts & {
    nodeId: NodeId;
    historyEntryId?: string;
    modelId: string;
  },
): Promise<string> {
  const request = buildVideoRequest(opts);
  const submitted = await submitBackgroundVideoTask({
    clientId: getVideoTaskClientId(),
    nodeId: opts.nodeId,
    historyEntryId: opts.historyEntryId,
    model: opts.modelId,
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey ?? '',
    request,
  });
  const completed = await waitForBackgroundVideoTask(submitted.id);
  if (!completed.resultUrl) throw new Error('后台视频任务完成但缺少结果 URL');
  return completed.resultUrl;
}

function getPendingHistoryDraft(
  node: AppNode,
  nodes: AppNode[],
  edges: AppEdge[],
): HistoryDraft | null {
  if (node.kind === 'gen-image') {
    const upstream = resolveUpstream(node.id, nodes, edges);
    const modelId = normalizeImageModelId(node.settings.model);
    return {
      nodeId: node.id,
      nodeKind: node.kind,
      kind: 'image',
      model: modelId,
      prompt: upstream.prompt || node.settings.prompt,
      sizeDesc: `${node.settings.ratio ?? '1:1'} · ${resolveImageSize(node.settings)} · ${node.settings.count ?? 1}张`,
      refsCount: upstream.referenceImages.length,
    };
  }

  if (node.kind === 'direct-final-render') {
    const context = collectDirectFinalGraphContext(node.id, nodes, edges);
    const modelId = normalizeImageModelId(node.settings.model);
    const count = clampDirectFinalRenderCount(node.settings.count);
    return {
      nodeId: node.id,
      nodeKind: node.kind,
      kind: 'image',
      model: modelId,
      prompt: context.asset?.goal || node.settings.prompt,
      sizeDesc: `${node.settings.ratio ?? '1:1'} · ${resolveImageSize(node.settings)} · ${count}张`,
      refsCount: context.sourceImages.length,
    };
  }

  if (node.kind === 'gen-video') {
    const upstream = resolveUpstream(node.id, nodes, edges);
    return {
      nodeId: node.id,
      nodeKind: node.kind,
      kind: 'video',
      model: node.settings.model,
      prompt: upstream.prompt || node.settings.videoPrompt,
      sizeDesc: `${node.settings.duration ?? '5s'} · ${node.settings.ratio ?? '16:9'} · ${node.settings.resolution ?? '720p'}`,
      refsCount: upstream.referenceImages.length,
    };
  }

  if (node.kind === 'generate-character-image' || node.kind === 'generate-scene-image') {
    return {
      nodeId: node.id,
      nodeKind: node.kind,
      kind: 'image',
      model: normalizeImageModelId(node.settings.model),
      prompt: node.settings.prompt,
      sizeDesc: `${node.settings.ratio ?? '1:1'} · ${node.settings.resolution ?? '1024x1024'}`,
    };
  }

  if (node.kind === 'generate-character-video' || node.kind === 'generate-scene-video') {
    return {
      nodeId: node.id,
      nodeKind: node.kind,
      kind: 'video',
      model: node.settings.model,
      prompt: node.settings.videoPrompt,
      sizeDesc: `${node.settings.duration ?? '5s'} · ${node.settings.ratio ?? '16:9'} · ${node.settings.resolution ?? '720p'}`,
    };
  }

  return null;
}

async function runImageGen(
  node: GenImageNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<RunResult> {
  const modelId = normalizeImageModelId(node.settings.model);
  const model = getModelDef(modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);

  const { apiKey, baseUrl } = loadRuntime(model);

  const upstream = resolveUpstream(node.id, nodes, edges);
  const refs = upstream.referenceImages;
  const finalPrompt = upstream.prompt || node.settings.prompt;
  if (!finalPrompt) {
    throw new Error('prompt 为空（节点 prompt 与上游 text 节点均无内容）');
  }

  if (model.provider === 'midjourney') {
    const task = await mjImagine({ baseUrl, apiKey, prompt: finalPrompt });
    const original = task.imageUrl;
    if (!original) throw new Error('MJ 返回无 imageUrl');
    let images: string[];
    try {
      images = await splitMjGrid(original);
    } catch {
      images = [original];
    }
    const storedImages = await persistImageUrls(images, 'mj-image');
    useCanvas.getState().patchNode(node.id, {
      content: storedImages[0],
      generatedImages: storedImages,
      mjImages: storedImages,
      mjOriginalUrl: original,
      mjNeedsSplit: false,
    });
    return {
      kind: 'image',
      model: model.id,
      prompt: finalPrompt,
      contentUrl: storedImages[0],
      contentUrls: storedImages,
      sizeDesc: 'MJ · 4-split',
      refsCount: refs.length,
    };
  }

  const ctx = {
    hasReferenceImages: refs.length > 0,
    hasMask: !!upstream.mask,
    useJimengLocalFile: Boolean(getPref('jimeng_use_local_file', false)),
  };
  const needsFileInput = routeRequest({ type: 'image' }, model, ctx).bodyKind === 'form';
  const count = node.settings.count ?? 1;
  const baseVars: Vars = {
    modelName: model.name,
    prompt: finalPrompt,
    size: resolveImageSize(node.settings),
    ratio: node.settings.ratio ?? '1:1',
    quality: resolveImageQuality(node.settings.quality),
    enableSequential: false,
  };
  if (refs.length > 0) {
    const { imageUrls, blobs } = await prepareReferenceInputs(refs, {
      includeBlobs: needsFileInput,
    });
    baseVars.imageUrls = imageUrls;
    if (blobs) baseVars.image = blobs;
  }
  if (upstream.mask && needsFileInput) baseVars.mask = await loadImageBlob(upstream.mask);

  const images: string[] = [];
  for (const n of splitImageBatch(count)) {
    const result = await generateImage({
      model,
      baseUrl,
      apiKey,
      vars: { ...baseVars, n },
      ctx,
    });
    images.push(...result.data.map(imageResultToUrl).filter((url): url is string => !!url));
  }
  const content = images[0];
  if (!content) throw new Error('生成结果无 url / b64_json');
  const storedImages = await persistImageUrls(images, 'generated-image');
  const storedContent = storedImages[0];
  if (!storedContent) throw new Error('生成结果持久化失败');
  useCanvas
    .getState()
    .patchNode(node.id, { content: storedContent, generatedImages: storedImages, mjImages: undefined });
  return {
    kind: 'image',
    model: model.id,
    prompt: finalPrompt,
    contentUrl: storedContent,
    contentUrls: storedImages,
    sizeDesc: `${node.settings.ratio ?? '1:1'} · ${resolveImageSize(node.settings)} · ${storedImages.length}张`,
    refsCount: refs.length,
  };
}

async function runDirectFinalAnalysis(
  node: DirectFinalAnalysisNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<void> {
  const patchSettings = useCanvas.getState().patchSettings;
  patchSettings<'direct-final-analysis'>(node.id, { isGenerating: true, error: null });
  try {
    const model = getModelDef(node.settings.model);
    if (!model) throw new Error(`未知模型: ${node.settings.model}`);
    const { apiKey, baseUrl } = loadRuntime(model);
    const context = collectDirectFinalGraphContext(node.id, nodes, edges);
    if (context.sourceImages.length === 0) throw new Error('请先连接成图源图。');

    if (node.settings.action === 'gates') {
      const brief = context.brief;
      if (!brief?.confirmedAt) throw new Error('先确认商业分析，再生成门禁节点。');
      if (brief.isStale) throw new Error('商业分析已过期，请重新确认后再生成门禁节点。');
      const raw = await requestStructuredJson({
        apiKey,
        baseUrl,
        model: model.name,
        instructions: buildSellingReasonInstructions(),
        inputText: buildSellingReasonInputText(brief, context.sourceImages),
        schema: SELLING_REASON_SCHEMA,
        schemaName: 'direct_final_selling_reasons',
        maxOutputTokens: 2200,
        imageDataUrls: context.sourceImages.map((image) => image.url),
      });
      const cards = createSellingReasonCardsFromPayload(raw, {
        model: model.id,
        limit: node.settings.gateCount ?? 5,
      });
      if (cards.length < 3) throw new Error('门禁节点数量不足 3 个。');
      const state = useCanvas.getState();
      const createdIds: NodeId[] = [];
      cards.forEach((card, index) => {
        const gate = createNode('direct-final-gate', {
          x: node.x + 430 + index * 380,
          y: node.y,
        });
        if (gate.kind !== 'direct-final-gate') return;
        gate.settings.card = card;
        state.addNode(gate);
        state.addEdge({ id: edgeId(), from: node.id, to: gate.id });
        createdIds.push(gate.id);
      });
      state.setSelection(createdIds);
      patchSettings<'direct-final-analysis'>(node.id, { isGenerating: false, error: null });
      return;
    }

    const raw = await requestStructuredJson({
      apiKey,
      baseUrl,
      model: model.name,
      instructions: buildCommercialBriefInstructions(),
      inputText: buildCommercialBriefInputText(context.sourceImages),
      schema: COMMERCIAL_BRIEF_SCHEMA,
      schemaName: 'direct_final_commercial_brief',
      maxOutputTokens: 1800,
      imageDataUrls: context.sourceImages.map((image) => image.url),
    });
    const brief = createCommercialBriefFromPayload(raw, {
      model: model.id,
      sourceImages: context.sourceImages,
      previous: node.settings.brief,
    });
    patchSettings<'direct-final-analysis'>(node.id, {
      brief,
      risk: buildRiskSummary(brief, context.sourceImages),
      isGenerating: false,
      error: null,
    });
  } catch (error) {
    patchSettings<'direct-final-analysis'>(node.id, {
      isGenerating: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function runDirectFinalPrompt(
  node: DirectFinalMainPromptNode | DirectFinalDetailPromptNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<void> {
  const patchSettings = useCanvas.getState().patchSettings;
  if (node.kind === 'direct-final-main-prompt') {
    patchSettings<'direct-final-main-prompt'>(node.id, { isGenerating: true, error: null });
  } else {
    patchSettings<'direct-final-detail-prompt'>(node.id, { isGenerating: true, error: null });
  }
  try {
    const model = getModelDef(node.settings.model);
    if (!model) throw new Error(`未知模型: ${node.settings.model}`);
    const { apiKey, baseUrl } = loadRuntime(model);
    const context = collectDirectFinalGraphContext(node.id, nodes, edges);
    const brief = context.brief;
    if (!brief?.confirmedAt) throw new Error('先确认商业分析，再生成成图脚本。');
    if (brief.isStale) throw new Error('商业分析已过期，请重新确认。');
    if (context.sourceImages.length === 0) throw new Error('缺少源图。');
    const cards = context.cards.filter((card) => Boolean(card.confirmedAt));
    if (cards.length === 0) throw new Error('先确认门禁节点，再生成成图脚本。');
    const risk = context.risk;
    const raw = await requestStructuredJson({
      apiKey,
      baseUrl,
      model: model.name,
      instructions: buildAssetInstructions({
        copyLanguage: node.settings.copyLanguage,
        slot: node.kind === 'direct-final-main-prompt' ? node.settings.slot : undefined,
        moduleCode: node.kind === 'direct-final-detail-prompt' ? node.settings.moduleCode : undefined,
      }),
      inputText: buildAssetInputText({
        brief,
        cards,
        risk,
        sourceImages: context.sourceImages,
        copyLanguage: node.settings.copyLanguage,
        slot: node.kind === 'direct-final-main-prompt' ? node.settings.slot : undefined,
        moduleCode: node.kind === 'direct-final-detail-prompt' ? node.settings.moduleCode : undefined,
      }),
      schema: DIRECT_FINAL_ASSET_SCHEMA,
      schemaName:
        node.kind === 'direct-final-main-prompt'
          ? 'direct_final_main_asset'
          : 'direct_final_detail_asset',
      maxOutputTokens: 2400,
      imageDataUrls: context.sourceImages.map((image) => image.url),
    });
    const asset = createAssetFromPayload(raw, {
      assetKind: node.kind === 'direct-final-main-prompt' ? 'main-image' : 'detail-module',
      slot: node.kind === 'direct-final-main-prompt' ? node.settings.slot : undefined,
      moduleCode: node.kind === 'direct-final-detail-prompt' ? node.settings.moduleCode : undefined,
      model: model.id,
      matchedCards: cards,
    });
    const assetWithSelfReview = {
      ...asset,
      selfReviewScore: evaluateDirectFinalAsset(brief, cards, asset).score,
    };
    if (node.kind === 'direct-final-main-prompt') {
      patchSettings<'direct-final-main-prompt'>(node.id, {
        asset: assetWithSelfReview,
        isGenerating: false,
        error: null,
      });
    } else {
      patchSettings<'direct-final-detail-prompt'>(node.id, {
        asset: assetWithSelfReview,
        isGenerating: false,
        error: null,
      });
    }
  } catch (error) {
    if (node.kind === 'direct-final-main-prompt') {
      patchSettings<'direct-final-main-prompt'>(node.id, {
        isGenerating: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } else {
      patchSettings<'direct-final-detail-prompt'>(node.id, {
        isGenerating: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

async function runDirectFinalRender(
  node: DirectFinalRenderNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<RunResult> {
  const patchSettings = useCanvas.getState().patchSettings;
  patchSettings<'direct-final-render'>(node.id, { isGenerating: true, error: null });
  try {
    const modelId = normalizeImageModelId(node.settings.model);
    const model = getModelDef(modelId);
    if (!model) throw new Error(`未知模型: ${modelId}`);
    const { apiKey, baseUrl } = loadRuntime(model);
    const context = collectDirectFinalGraphContext(node.id, nodes, edges);
    if (!context.brief) throw new Error('缺少商业分析。');
    if (!context.brief.confirmedAt) throw new Error('先确认商业分析，再生成最终图。');
    if (context.brief.isStale) throw new Error('商业分析已过期，请重新确认。');
    if (!context.asset) throw new Error('缺少 direct-final 成图脚本。');
    if (context.sourceImages.length === 0) throw new Error('缺少源图。');
    const finalPrompt = buildDirectFinalExecutionPrompt({
      brief: context.brief,
      asset: context.asset,
      copyLanguage: node.settings.copyLanguage,
      aspectRatio: node.settings.ratio ?? '1:1',
    });
    const refs = context.sourceImages.map((image) => image.url);

    if (model.provider === 'midjourney') {
      throw new Error('成图执行需要支持源图参考的图片模型，当前 Midjourney 路由不会传入源图。请切换为支持图片编辑/图生图的模型。');
    }

    const ctx = {
      hasReferenceImages: refs.length > 0,
      hasMask: false,
      useJimengLocalFile: Boolean(getPref('jimeng_use_local_file', false)),
    };
    const needsFileInput = routeRequest({ type: 'image' }, model, ctx).bodyKind === 'form';
    const { imageUrls, blobs } = await prepareReferenceInputs(refs, { includeBlobs: needsFileInput });
    const baseVars: Vars = {
      modelName: model.name,
      prompt: finalPrompt,
      size: resolveImageSize(node.settings),
      ratio: node.settings.ratio ?? '1:1',
      quality: resolveImageQuality(node.settings.quality),
      enableSequential: false,
      imageUrls,
    };
    if (blobs) baseVars.image = blobs;

    const count = clampDirectFinalRenderCount(node.settings.count);
    const images: string[] = [];
    for (const n of splitImageBatch(count)) {
      const result = await generateImage({
        model,
        baseUrl,
        apiKey,
        vars: { ...baseVars, n },
        ctx,
      });
      images.push(...result.data.map(imageResultToUrl).filter((url): url is string => !!url));
    }
    const content = images[0];
    if (!content) throw new Error('生成结果无 url / b64_json');
    const storedImages = await persistImageUrls(images, 'direct-final-image');
    const storedContent = storedImages[0];
    if (!storedContent) throw new Error('生成结果持久化失败');
    useCanvas.getState().patchNode(node.id, {
      content: storedContent,
      generatedImages: storedImages,
      mjImages: undefined,
    });
    patchSettings<'direct-final-render'>(node.id, {
      prompt: finalPrompt,
      isGenerating: false,
      error: null,
    });
    return {
      kind: 'image',
      model: model.id,
      prompt: finalPrompt,
      contentUrl: storedContent,
      contentUrls: storedImages,
      sizeDesc: `${node.settings.ratio ?? '1:1'} · ${resolveImageSize(node.settings)} · ${storedImages.length}张`,
      refsCount: refs.length,
    };
  } catch (error) {
    patchSettings<'direct-final-render'>(node.id, {
      isGenerating: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function runDirectFinalReview(
  node: DirectFinalReviewNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<void> {
  const patchSettings = useCanvas.getState().patchSettings;
  patchSettings<'direct-final-review'>(node.id, { isGenerating: true, error: null });
  try {
    const model = getModelDef(node.settings.model);
    if (!model) throw new Error(`未知模型: ${node.settings.model}`);
    const { apiKey, baseUrl } = loadRuntime(model);
    const context = collectDirectFinalGraphContext(node.id, nodes, edges);
    const renderNode = context.renderNode;
    if (!context.brief) throw new Error('缺少商业分析。');
    if (!context.promptNode || !context.asset) throw new Error('缺少成图脚本。');
    if (!renderNode?.content) throw new Error('缺少成图结果。');
    if (context.sourceImages.length === 0) throw new Error('缺少源图。');
    const raw = await requestStructuredJson({
      apiKey,
      baseUrl,
      model: model.name,
      instructions: buildReviewInstructions(node.settings.copyLanguage),
      inputText: buildReviewInputText({
        brief: context.brief,
        asset: context.asset,
        sourceImages: context.sourceImages,
        copyLanguage: node.settings.copyLanguage,
        risk: context.risk,
      }),
      schema: DIRECT_FINAL_REVIEW_SCHEMA,
      schemaName: 'direct_final_review',
      maxOutputTokens: 1600,
      imageDataUrls: [...context.sourceImages.map((image) => image.url), renderNode.content],
    });
    const review = createReviewFromPayload(raw, {
      outputNodeId: renderNode.id,
      promptNodeId: context.promptNode.id,
      assetId: context.asset.assetId,
      copyLanguage: node.settings.copyLanguage,
    });
    patchSettings<'direct-final-review'>(node.id, { review, isGenerating: false, error: null });
  } catch (error) {
    patchSettings<'direct-final-review'>(node.id, {
      isGenerating: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function runVideoGen(
  node: GenVideoNode,
  nodes: AppNode[],
  edges: AppEdge[],
  patch: PatchFn,
  historyEntryId?: string,
): Promise<RunResult> {
  const model = getModelDef(node.settings.model);
  if (!model) throw new Error(`未知模型: ${node.settings.model}`);

  const { apiKey, baseUrl } = loadRuntime(model);

  const upstream = resolveUpstream(node.id, nodes, edges);
  const finalPrompt = upstream.prompt || node.settings.videoPrompt;
  if (!finalPrompt) throw new Error('video prompt 为空');

  const ctx = {
    hasReferenceImages: upstream.referenceImages.length > 0 || upstream.audioUrls.length > 0,
    hasMask: false,
    useJimengLocalFile: false,
  };
  const videoMode = node.settings.videoMode ?? 'omni-reference';
  if (isWan27I2VModel(model.id) && videoMode === 'omni-reference') {
    throw new Error('wan2.7-i2v 不支持全能参考模式，请切换为首尾帧或选择可灵模型');
  }
  validateHappyHorseVideoInputs(
    model.id,
    upstream.referenceImages.length,
    Boolean(upstream.videoUrl),
    videoMode,
  );
  const vars: Vars = {
    modelName: model.name,
    prompt: finalPrompt,
    duration: resolveVideoDuration(model.id, node.settings.duration),
    size: resolveVideoSizeForModel(model.id, node.settings.ratio, node.settings.resolution),
    ratio: resolveVideoRatio(node.settings.ratio),
    resolution: resolveVideoResolutionForModel(model.id, node.settings.resolution),
  };
  vars.metadata = happyHorseMetadataForModel(
    model.id,
    node.settings.ratio,
    node.settings.resolution,
  );
  const audioUrls =
    upstream.audioUrls.length > 0
      ? await prepareAudioUrls(upstream.audioUrls, { baseUrl, apiKey })
      : [];
  vars.metadata = mergeVideoMetadata(vars.metadata, audioReferenceMetadata(audioUrls));
  vars.mode = videoMode === 'first-last-frame' ? 'first_last_frame' : 'multi_ref';
  if (isSeedanceVideoModel(model.id)) {
    const imageUrls =
      upstream.referenceImages.length > 0
        ? await prepareReferenceImageUrls(upstream.referenceImages)
        : [];
    const seedanceVars = buildSeedanceVideoVars({
      modelName: model.name,
      prompt: finalPrompt,
      duration: resolveVideoDuration(model.id, node.settings.duration),
      ratio: resolveVideoRatio(node.settings.ratio),
      resolution: resolveVideoResolutionForModel(model.id, node.settings.resolution),
      imageUrls,
      videoUrl: upstream.videoUrl,
      audioUrls,
      mode: videoMode,
    });
    const url = await runVideoViaBackgroundTask({
      model,
      baseUrl,
      apiKey,
      vars: seedanceVars,
      ctx,
      nodeId: node.id,
      historyEntryId,
      modelId: model.id,
    });
    if (!url) throw new Error('鐢熸垚缁撴灉鏃?url');
    patch(node.id, { content: url });
    return {
      kind: 'video',
      model: model.id,
      prompt: finalPrompt,
      contentUrl: url,
      sizeDesc: `${seedanceVars.duration}s 路 ${seedanceVars.ratio} 路 ${seedanceVars.resolution}`,
      refsCount: upstream.referenceImages.length,
    };
  }
  if (videoMode === 'first-last-frame') {
    if (upstream.referenceImages.length < 2) {
      throw new Error('首尾帧模式需要连接至少 2 张参考图');
    }
    const imageUrls = await prepareReferenceImageUrls(upstream.referenceImages.slice(0, 2));
    if (isKlingVideoModel(model.id)) {
      vars.input = klingNativeInput(finalPrompt, imageUrls, null, videoMode);
      vars.parameters = klingNativeParameters(
        node.settings.ratio,
        vars.resolution as string,
        vars.duration as string,
      );
    } else if (isWan27I2VModel(model.id)) {
      vars.metadata = mergeVideoMetadata(vars.metadata, wan27MediaMetadata(imageUrls, null, videoMode));
    } else {
      vars.imageUrls = imageUrls;
    }
  } else {
    let imageUrls: string[] = [];
    if (upstream.referenceImages.length > 0) {
      imageUrls = await prepareReferenceImageUrls(upstream.referenceImages);
    }
    if (isWan27I2VModel(model.id)) {
      if (imageUrls.length > 1) {
        throw new Error('wan2.7-i2v 全能参考不支持多张图片；请改用可灵全能参考，或只连接 1 张图片');
      }
      vars.metadata = mergeVideoMetadata(
        vars.metadata,
        wan27MediaMetadata(imageUrls, upstream.videoUrl, videoMode),
      );
    } else if (isKlingVideoModel(model.id)) {
      vars.input = klingNativeInput(finalPrompt, imageUrls, upstream.videoUrl, videoMode);
      vars.parameters = klingNativeParameters(
        node.settings.ratio,
        vars.resolution as string,
        vars.duration as string,
      );
    } else {
      if (imageUrls.length === 1) {
        vars.primaryImageUrl = imageUrls[0];
      } else if (imageUrls.length > 1) {
        vars.imageUrls = imageUrls;
      }
      if (upstream.videoUrl) {
        vars.metadata = mergeVideoMetadata(
          vars.metadata,
          model.id === 'happyhorse-1.0-video-edit'
            ? { input: { media: [{ type: 'first_clip', url: upstream.videoUrl }] } }
            : { video_urls: [upstream.videoUrl] },
        );
      }
    }
  }

  const url = await runVideoViaBackgroundTask({
    model,
    baseUrl,
    apiKey,
    vars,
    ctx,
    nodeId: node.id,
    historyEntryId,
    modelId: model.id,
  });
  if (!url) throw new Error('生成结果无 url');
  patch(node.id, { content: url });
  return {
    kind: 'video',
    model: model.id,
    prompt: finalPrompt,
    contentUrl: url,
    sizeDesc: `${node.settings.duration ?? '5s'} · ${node.settings.ratio ?? '16:9'} · ${node.settings.resolution ?? '720p'}`,
    refsCount: upstream.referenceImages.length,
  };
}

async function runVideoAnalyze(
  node: VideoAnalyzeNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<void> {
  const model = getModelDef(node.settings.model);
  if (!model) throw new Error(`未知模型: ${node.settings.model}`);

  const { apiKey, baseUrl } = loadRuntime(model);

  const upstream = resolveUpstream(node.id, nodes, edges);
  const frames = upstream.videoFrames;
  if (frames.length === 0) {
    throw new Error('上游 video-input 需要先截取关键帧');
  }
  const instruction =
    node.settings.instruction?.trim() ||
    '请按时间顺序描述以下视频关键帧组成的内容（人物 / 动作 / 场景变化）。';

  const userContent: ChatContent = [
    { type: 'text', text: instruction },
    ...frames.slice(0, 16).map((f) => ({
      type: 'image_url' as const,
      image_url: { url: f.url },
    })),
  ];

  const result = await chatComplete({
    model,
    baseUrl,
    apiKey,
    messages: [
      { role: 'system', content: '你是视频分析助手。回答简洁、结构化。' },
      { role: 'user', content: userContent },
    ],
  });
  const text = result.choices[0]?.message?.content;
  if (!text) throw new Error('chat 返回空内容');
  useCanvas.getState().patchSettings<'video-analyze'>(node.id, { analysisResult: text });
}

async function prepareReferenceImageUrls(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.slice(0, 5).map(async (url, index) => {
      if (isHttpUrl(url)) return url;
      if (url.startsWith('data:')) return url;
      if (url.startsWith('blob:')) return blobToDataURL(await loadImageBlob(url));
      return persistImageUrl(url, `reference-${index + 1}`);
    }),
  );
}

async function runGenerateCharacterImage(
  node: GenerateCharacterImageNode,
  patch: PatchFn,
): Promise<RunResult> {
  const { apiKey, baseUrl } = loadRuntime();
  const modelId = normalizeImageModelId(node.settings.model);
  const model = getModelDef(modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);
  const charId = node.settings.characterId;
  if (!charId) throw new Error('未选择角色');
  const character = useLibrary.getState().characters.find((c) => c.id === charId);
  if (!character) throw new Error('角色不存在（可能被删除）');

  const promptParts = [character.prompt || character.description, node.settings.prompt].filter(
    Boolean,
  );
  const finalPrompt = promptParts.join('\n').trim();
  if (!finalPrompt) throw new Error('角色 prompt/description 与节点 prompt 都为空');

  const vars: Vars = {
    modelName: model.name,
    prompt: finalPrompt,
    n: 1,
    size: node.settings.resolution ?? '1024x1024',
    ratio: node.settings.ratio ?? '1:1',
    quality: 'standard',
    enableSequential: false,
  };
  const result = await generateImage({
    model,
    baseUrl,
    apiKey,
    vars,
    ctx: { hasReferenceImages: false, hasMask: false, useJimengLocalFile: false },
  });
  const content = imageResultToUrl(result.data[0] ?? {});
  if (!content) throw new Error('生成结果无 url / b64_json');
  const storedContent = await persistImageUrl(content, 'character-image');
  patch(node.id, { content: storedContent });
  // 同步回 library
  await useLibrary.getState().patchCharacter(charId, { imageUrl: storedContent });
  return {
    kind: 'image',
    model: model.id,
    prompt: finalPrompt,
    contentUrl: storedContent,
    contentUrls: [storedContent],
    sizeDesc: `${node.settings.ratio ?? '1:1'} · ${node.settings.resolution ?? '1024'} · ${character.name}`,
  };
}

async function runGenerateSceneImage(
  node: GenerateSceneImageNode,
  patch: PatchFn,
): Promise<RunResult> {
  const { apiKey, baseUrl } = loadRuntime();
  const modelId = normalizeImageModelId(node.settings.model);
  const model = getModelDef(modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);
  const sceneId = node.settings.sceneId;
  if (!sceneId) throw new Error('未选择场景');
  const scene = useLibrary.getState().scenes.find((c) => c.id === sceneId);
  if (!scene) throw new Error('场景不存在（可能被删除）');

  const promptParts = [scene.prompt || scene.description, node.settings.prompt].filter(Boolean);
  const finalPrompt = promptParts.join('\n').trim();
  if (!finalPrompt) throw new Error('场景 prompt/description 与节点 prompt 都为空');

  const vars: Vars = {
    modelName: model.name,
    prompt: finalPrompt,
    n: 1,
    size: node.settings.resolution ?? '1024x1024',
    ratio: node.settings.ratio ?? '16:9',
    quality: 'standard',
    enableSequential: false,
  };
  const result = await generateImage({
    model,
    baseUrl,
    apiKey,
    vars,
    ctx: { hasReferenceImages: false, hasMask: false, useJimengLocalFile: false },
  });
  const content = imageResultToUrl(result.data[0] ?? {});
  if (!content) throw new Error('生成结果无 url / b64_json');
  const storedContent = await persistImageUrl(content, 'scene-image');
  patch(node.id, { content: storedContent });
  await useLibrary.getState().patchScene(sceneId, { imageUrl: storedContent });
  return {
    kind: 'image',
    model: model.id,
    prompt: finalPrompt,
    contentUrl: storedContent,
    contentUrls: [storedContent],
    sizeDesc: `${node.settings.ratio ?? '16:9'} · ${node.settings.resolution ?? '1024'} · ${scene.name}`,
  };
}

async function runGenerateCharacterVideo(
  node: GenerateCharacterVideoNode,
  nodes: AppNode[],
  edges: AppEdge[],
  patch: PatchFn,
  historyEntryId?: string,
): Promise<RunResult> {
  const model = getModelDef(node.settings.model);
  if (!model) throw new Error(`未知模型: ${node.settings.model}`);

  const { apiKey, baseUrl } = loadRuntime(model);
  const charId = node.settings.characterId;
  if (!charId) throw new Error('未选择角色');
  const character = useLibrary.getState().characters.find((c) => c.id === charId);
  if (!character) throw new Error('角色不存在');

  const promptParts = [character.prompt || character.description, node.settings.videoPrompt].filter(
    Boolean,
  );
  const prompt = promptParts.join('\n').trim();
  if (!prompt) throw new Error('prompt 为空');

  const upstream = resolveUpstream(node.id, nodes, edges);
  const audioUrls =
    upstream.audioUrls.length > 0
      ? await prepareAudioUrls(upstream.audioUrls, { baseUrl, apiKey })
      : [];

  const vars: Vars = {
    modelName: model.name,
    prompt,
    duration: resolveVideoDuration(model.id, node.settings.duration),
    size: resolveVideoSizeForModel(model.id, node.settings.ratio, node.settings.resolution),
    ratio: resolveVideoRatio(node.settings.ratio),
    resolution: resolveVideoResolutionForModel(model.id, node.settings.resolution),
  };
  vars.metadata = happyHorseMetadataForModel(
    model.id,
    node.settings.ratio,
    node.settings.resolution,
  );
  vars.metadata = mergeVideoMetadata(vars.metadata, audioReferenceMetadata(audioUrls));
  let seedanceImageUrls: string[] = [];
  if (character.imageUrl) {
    const imageUrls = await prepareReferenceImageUrls([character.imageUrl]);
    seedanceImageUrls = imageUrls;
    vars.primaryImageUrl = imageUrls[0];
    vars.imageUrls = imageUrls;
  }
  if (isSeedanceVideoModel(model.id)) {
    const seedanceVars = buildSeedanceVideoVars({
      modelName: model.name,
      prompt,
      duration: vars.duration as string,
      ratio: vars.ratio as string,
      resolution: vars.resolution as string,
      imageUrls: seedanceImageUrls,
      audioUrls,
      mode: 'omni-reference',
    });
    const url = await runVideoViaBackgroundTask({
      model,
      baseUrl,
      apiKey,
      vars: seedanceVars,
      ctx: {
        hasReferenceImages: seedanceImageUrls.length > 0 || audioUrls.length > 0,
        hasMask: false,
        useJimengLocalFile: false,
      },
      nodeId: node.id,
      historyEntryId,
      modelId: model.id,
    });
    if (!url) throw new Error('鐢熸垚缁撴灉鏃?url');
    patch(node.id, { content: url });
    return {
      kind: 'video',
      model: model.id,
      prompt,
      contentUrl: url,
      sizeDesc: `${seedanceVars.duration}s 路 ${seedanceVars.ratio} 路 ${character.name}`,
    };
  }
  const url = await runVideoViaBackgroundTask({
    model,
    baseUrl,
    apiKey,
    vars,
    ctx: {
      hasReferenceImages: !!character.imageUrl || audioUrls.length > 0,
      hasMask: false,
      useJimengLocalFile: false,
    },
    nodeId: node.id,
    historyEntryId,
    modelId: model.id,
  });
  if (!url) throw new Error('生成结果无 url');
  patch(node.id, { content: url });
  return {
    kind: 'video',
    model: model.id,
    prompt,
    contentUrl: url,
    sizeDesc: `${node.settings.duration ?? '5s'} · ${node.settings.ratio ?? '16:9'} · ${character.name}`,
  };
}

async function runGenerateSceneVideo(
  node: GenerateSceneVideoNode,
  nodes: AppNode[],
  edges: AppEdge[],
  patch: PatchFn,
  historyEntryId?: string,
): Promise<RunResult> {
  const model = getModelDef(node.settings.model);
  if (!model) throw new Error(`未知模型: ${node.settings.model}`);

  const { apiKey, baseUrl } = loadRuntime(model);
  const sceneId = node.settings.sceneId;
  if (!sceneId) throw new Error('未选择场景');
  const scene = useLibrary.getState().scenes.find((c) => c.id === sceneId);
  if (!scene) throw new Error('场景不存在');

  const promptParts = [scene.prompt || scene.description, node.settings.videoPrompt].filter(
    Boolean,
  );
  const prompt = promptParts.join('\n').trim();
  if (!prompt) throw new Error('prompt 为空');

  const upstream = resolveUpstream(node.id, nodes, edges);
  const audioUrls =
    upstream.audioUrls.length > 0
      ? await prepareAudioUrls(upstream.audioUrls, { baseUrl, apiKey })
      : [];

  const vars: Vars = {
    modelName: model.name,
    prompt,
    duration: resolveVideoDuration(model.id, node.settings.duration),
    size: resolveVideoSizeForModel(model.id, node.settings.ratio, node.settings.resolution),
    ratio: resolveVideoRatio(node.settings.ratio),
    resolution: resolveVideoResolutionForModel(model.id, node.settings.resolution),
  };
  vars.metadata = happyHorseMetadataForModel(
    model.id,
    node.settings.ratio,
    node.settings.resolution,
  );
  vars.metadata = mergeVideoMetadata(vars.metadata, audioReferenceMetadata(audioUrls));
  let seedanceImageUrls: string[] = [];
  if (scene.imageUrl) {
    const imageUrls = await prepareReferenceImageUrls([scene.imageUrl]);
    seedanceImageUrls = imageUrls;
    vars.primaryImageUrl = imageUrls[0];
    vars.imageUrls = imageUrls;
  }
  if (isSeedanceVideoModel(model.id)) {
    const seedanceVars = buildSeedanceVideoVars({
      modelName: model.name,
      prompt,
      duration: vars.duration as string,
      ratio: vars.ratio as string,
      resolution: vars.resolution as string,
      imageUrls: seedanceImageUrls,
      audioUrls,
      mode: 'omni-reference',
    });
    const url = await runVideoViaBackgroundTask({
      model,
      baseUrl,
      apiKey,
      vars: seedanceVars,
      ctx: {
        hasReferenceImages: seedanceImageUrls.length > 0 || audioUrls.length > 0,
        hasMask: false,
        useJimengLocalFile: false,
      },
      nodeId: node.id,
      historyEntryId,
      modelId: model.id,
    });
    if (!url) throw new Error('鐢熸垚缁撴灉鏃?url');
    patch(node.id, { content: url });
    return {
      kind: 'video',
      model: model.id,
      prompt,
      contentUrl: url,
      sizeDesc: `${seedanceVars.duration}s 路 ${seedanceVars.ratio} 路 ${scene.name}`,
    };
  }
  const url = await runVideoViaBackgroundTask({
    model,
    baseUrl,
    apiKey,
    vars,
    ctx: {
      hasReferenceImages: !!scene.imageUrl || audioUrls.length > 0,
      hasMask: false,
      useJimengLocalFile: false,
    },
    nodeId: node.id,
    historyEntryId,
    modelId: model.id,
  });
  if (!url) throw new Error('生成结果无 url');
  patch(node.id, { content: url });
  return {
    kind: 'video',
    model: model.id,
    prompt,
    contentUrl: url,
    sizeDesc: `${node.settings.duration ?? '5s'} · ${node.settings.ratio ?? '16:9'} · ${scene.name}`,
  };
}

async function runExtractCharactersScenes(
  node: ExtractCharactersScenesNode,
  nodes: AppNode[],
  edges: AppEdge[],
): Promise<void> {
  const model = getModelDef(node.settings.model);
  if (!model) throw new Error(`未知模型: ${node.settings.model}`);

  const { apiKey, baseUrl } = loadRuntime(model);

  const upstream = resolveUpstream(node.id, nodes, edges);
  const source = (upstream.prompt || node.settings.sourceText || '').trim();
  if (!source) throw new Error('源文本为空（连一个 text-node 或粘贴文本）');

  const result = await chatComplete({
    model,
    baseUrl,
    apiKey,
    messages: [
      {
        role: 'system',
        content:
          '你是文本分析助手。请从用户提供的小说 / 文本中抽取出现的全部角色和场景。' +
          '严格输出 JSON（不要任何额外解释，不要 markdown 代码块包裹）：' +
          '{"characters":[{"name":"...","description":"..."}],"scenes":[{"name":"...","description":"..."}]}',
      },
      { role: 'user', content: source },
    ],
  });
  const text = result.choices[0]?.message?.content ?? '';
  // 尝试从可能含 markdown 围栏的响应里捞 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('chat 返回未包含 JSON');
  let parsed: { characters?: unknown; scenes?: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('chat 返回的 JSON 解析失败');
  }
  const characters = sanitize(parsed.characters);
  const scenes = sanitize(parsed.scenes);
  useCanvas.getState().patchSettings<'extract-characters-scenes'>(node.id, { characters, scenes });
}

function sanitize(raw: unknown): Array<{ name: string; description: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name : '';
      const description = typeof o.description === 'string' ? o.description : '';
      if (!name) return null;
      return { name, description };
    })
    .filter((x): x is { name: string; description: string } => x !== null);
}

async function runCharacterCard(node: CharacterCardNode): Promise<RunResult> {
  const { apiKey, baseUrl } = loadRuntime();
  const modelId = normalizeImageModelId(node.settings.model);
  const model = getModelDef(modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);

  const { inputMode, textDescription, referenceImage, viewType, expressions, imageSize } =
    node.settings;

  // 验证输入
  if (inputMode === 'text' && !textDescription) {
    throw new Error('请输入角色描述');
  }
  if (inputMode === 'image' && !referenceImage) {
    throw new Error('请上传参考图片');
  }

  // 确保图片尺寸满足最小要求（768x768 = 589,824 像素）
  const safeImageSize = Math.max(768, imageSize);

  // 更新进度
  useCanvas.getState().patchSettings<'character-card'>(node.id, {
    isGenerating: true,
    progress: 0,
    error: null,
  });

  try {
    // Step 1: 生成多视图
    useCanvas.getState().patchSettings<'character-card'>(node.id, { progress: 10 });
    const multiViewPrompt = buildMultiViewPrompt(textDescription || '', viewType, inputMode);
    const multiViewVars: Vars = {
      modelName: model.name,
      prompt: multiViewPrompt,
      n: 1,
      size: `${safeImageSize * (viewType === 'three' ? 3 : 4)}x${safeImageSize}`,
      ratio: viewType === 'three' ? '3:1' : '4:1',
      quality: 'standard',
      enableSequential: false,
    };

    // 如果是图片模式，添加参考图
    if (inputMode === 'image' && referenceImage) {
      const imageUrls = await prepareReferenceImageUrls([referenceImage]);
      multiViewVars.imageUrls = imageUrls;
    }

    const multiViewResult = await generateImage({
      model,
      baseUrl,
      apiKey,
      vars: multiViewVars,
      ctx: {
        hasReferenceImages: inputMode === 'image',
        hasMask: false,
        useJimengLocalFile: false,
      },
    });

    const multiViewUrl = imageResultToUrl(multiViewResult.data[0] ?? {});
    if (!multiViewUrl) throw new Error('多视图生成失败');
    const storedMultiView = await persistImageUrl(multiViewUrl, 'character-multiview');

    useCanvas.getState().patchSettings<'character-card'>(node.id, {
      multiViewImage: storedMultiView,
      progress: 30,
    });

    // Step 2: 生成表情图（使用多视图作为参考）
    const expressionImages: Partial<Record<ExpressionType, string>> = {};
    const totalExpressions = expressions.length;

    for (let i = 0; i < totalExpressions; i++) {
      const expr = expressions[i];
      const progress = 30 + Math.floor((i / totalExpressions) * 50);
      useCanvas.getState().patchSettings<'character-card'>(node.id, { progress });

      const exprPrompt = buildExpressionPrompt(
        textDescription || '',
        expr,
        inputMode,
      );
      const exprVars: Vars = {
        modelName: model.name,
        prompt: exprPrompt,
        n: 1,
        size: `${safeImageSize}x${safeImageSize}`,
        ratio: '1:1',
        quality: 'standard',
        enableSequential: false,
      };

      // 使用多视图作为参考图，保持角色一致性
      const refImages = inputMode === 'image' && referenceImage
        ? [referenceImage, storedMultiView]
        : [storedMultiView];
      const imageUrls = await prepareReferenceImageUrls(refImages);
      exprVars.imageUrls = imageUrls;

      const exprResult = await generateImage({
        model,
        baseUrl,
        apiKey,
        vars: exprVars,
        ctx: {
          hasReferenceImages: true,
          hasMask: false,
          useJimengLocalFile: false,
        },
      });

      const exprUrl = imageResultToUrl(exprResult.data[0] ?? {});
      if (!exprUrl) throw new Error(`表情 ${expr} 生成失败`);
      const storedExpr = await persistImageUrl(exprUrl, `character-expr-${expr}`);
      expressionImages[expr] = storedExpr;
    }

    useCanvas.getState().patchSettings<'character-card'>(node.id, {
      expressionImages: expressionImages as Record<ExpressionType, string>,
      progress: 80,
    });

    // Step 3: 合成最终角色卡
    console.log('开始合成角色卡', {
      multiViewImage: storedMultiView,
      expressionImages,
      layout: node.settings,
    });

    const finalCard = await composeCharacterCard({
      multiViewImage: storedMultiView,
      expressionImages: expressionImages as Record<ExpressionType, string>,
      layout: node.settings,
    });

    console.log('合成完成，开始持久化');

    const storedFinalCard = await persistImageUrl(finalCard, 'character-card');

    useCanvas.getState().patchSettings<'character-card'>(node.id, {
      finalCardImage: storedFinalCard,
      progress: 100,
      isGenerating: false,
    });

    useCanvas.getState().patchNode(node.id, { content: storedFinalCard });

    return {
      kind: 'image',
      model: model.id,
      prompt: textDescription || '角色卡',
      contentUrl: storedFinalCard,
      sizeDesc: `${viewType === 'three' ? '三视图' : '四视图'} + ${expressions.length}表情`,
    };
  } catch (err) {
    useCanvas.getState().patchSettings<'character-card'>(node.id, {
      isGenerating: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function buildMultiViewPrompt(
  description: string,
  viewType: 'three' | 'four',
  inputMode?: 'text' | 'image',
): string {
  const viewCount = viewType === 'three' ? 'three views' : 'four views';
  const views =
    viewType === 'three'
      ? '(front view, side view, back view)'
      : '(front view, 3/4 view, side view, back view)';

  if (inputMode === 'image') {
    return `Character turnaround sheet, ${viewCount} ${views}, same character in different angles, white background, character design, concept art, consistent style, professional character sheet`;
  }

  return `Character turnaround sheet, ${viewCount} ${views}, ${description}, white background, character design, concept art, same character in different angles, consistent style, professional character sheet`;
}

function buildExpressionPrompt(
  description: string,
  expression: ExpressionType,
  inputMode?: 'text' | 'image',
): string {
  const expressionMap: Record<ExpressionType, string> = {
    happy: 'happy, smiling',
    sad: 'sad, crying',
    angry: 'angry, furious',
    surprised: 'surprised, shocked',
    neutral: 'neutral, calm',
    excited: 'excited, enthusiastic',
    worried: 'worried, anxious',
    shy: 'shy, blushing',
  };

  const exprDesc = expressionMap[expression];

  if (inputMode === 'image') {
    return `Character portrait, ${exprDesc} expression, close-up face, white background, character design, consistent with reference, emotional expression, same character`;
  }

  return `Character portrait, ${exprDesc} expression, ${description}, close-up face, white background, character design, emotional expression`;
}

export function useGenerationTrigger() {
  const enqueue = useTasks((s) => s.enqueue);
  const patchNode = useCanvas((s) => s.patchNode);

  return useCallback(
    (nodeId: NodeId): TriggerResult => {
      const initialState = useCanvas.getState();
      const initialNode = initialState.nodes.find((n) => n.id === nodeId);
      if (initialNode && !isNodeFeatureEnabled(initialNode.kind)) {
        window.alert(FEATURE_DISABLED_MESSAGE);
        return { taskId: `disabled-${nodeId}` };
      }
      const historyEntry = initialNode
        ? createPendingHistory(initialNode, initialState.nodes, initialState.edges)
        : null;

      const taskId = enqueue(nodeId, async () => {
        const state = useCanvas.getState();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) throw new Error('节点不存在');
        const startedAt = Date.now();
        let result: RunResult | null = null;
        try {
          if (node.kind === 'gen-image') {
            result = await runImageGen(node, state.nodes, state.edges);
          } else if (node.kind === 'direct-final-analysis') {
            await runDirectFinalAnalysis(node, state.nodes, state.edges);
          } else if (
            node.kind === 'direct-final-main-prompt' ||
            node.kind === 'direct-final-detail-prompt'
          ) {
            await runDirectFinalPrompt(node, state.nodes, state.edges);
          } else if (node.kind === 'direct-final-render') {
            result = await runDirectFinalRender(node, state.nodes, state.edges);
          } else if (node.kind === 'direct-final-review') {
            await runDirectFinalReview(node, state.nodes, state.edges);
          } else if (node.kind === 'gen-video') {
            result = await runVideoGen(
              node,
              state.nodes,
              state.edges,
              patchNode,
              historyEntry?.id,
            );
          } else if (node.kind === 'video-analyze') {
            await runVideoAnalyze(node, state.nodes, state.edges);
          } else if (node.kind === 'generate-character-image') {
            result = await runGenerateCharacterImage(node, patchNode);
          } else if (node.kind === 'generate-scene-image') {
            result = await runGenerateSceneImage(node, patchNode);
          } else if (node.kind === 'generate-character-video') {
            result = await runGenerateCharacterVideo(
              node,
              state.nodes,
              state.edges,
              patchNode,
              historyEntry?.id,
            );
          } else if (node.kind === 'generate-scene-video') {
            result = await runGenerateSceneVideo(
              node,
              state.nodes,
              state.edges,
              patchNode,
              historyEntry?.id,
            );
          } else if (node.kind === 'extract-characters-scenes') {
            await runExtractCharactersScenes(node, state.nodes, state.edges);
          } else if (node.kind === 'character-card') {
            result = await runCharacterCard(node);
          } else {
            throw new Error(`不支持的触发类型: ${node.kind}`);
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          if (historyEntry) {
            void useHistory.getState().update(historyEntry.id, {
              status: 'failed',
              durationMs: Date.now() - startedAt,
              error,
            });
          } else if (result === null && isPersistableKind(node.kind)) {
            void useHistory.getState().push({
              nodeId,
              nodeKind: node.kind,
              kind: 'image',
              model: 'unknown',
              status: 'failed',
              durationMs: Date.now() - startedAt,
              error,
            });
          }
          throw err;
        }
        if (result) {
          if (node.kind === 'gen-video' && result.kind === 'video' && result.contentUrl) {
            patchNode(node.id, { content: result.contentUrl });
          }
          if (shouldCreateImageCompareNode(node.kind, result)) {
            createImageCompareResultNode(node, result);
          }
          if (shouldCreateVideoPreviewNode(node.kind, result)) {
            createVideoPreviewResultNode(node, result);
          }
          const completed = {
            kind: result.kind,
            model: result.model,
            prompt: result.prompt,
            content: result.contentUrl,
            contents: result.contentUrls,
            sizeDesc: result.sizeDesc,
            refsCount: result.refsCount,
            status: 'completed' as const,
            durationMs: Date.now() - startedAt,
          };
          if (historyEntry) {
            void useHistory.getState().update(historyEntry.id, completed);
          } else {
            void useHistory.getState().push({
              nodeId,
              nodeKind: node.kind,
              ...completed,
            });
          }
        }
      });
      return { taskId };
    },
    [enqueue, patchNode],
  );
}

function shouldCreateImageCompareNode(kind: NodeKind, result: RunResult): boolean {
  return (
    isNodeFeatureEnabled('image-compare') &&
    result.kind === 'image' &&
    IMAGE_RESULT_NODE_KINDS.has(kind) &&
    !!result.contentUrl
  );
}

function shouldCreateVideoPreviewNode(kind: NodeKind, result: RunResult): boolean {
  return (
    isNodeFeatureEnabled('preview') &&
    kind === 'gen-video' &&
    result.kind === 'video' &&
    !!result.contentUrl
  );
}

function createImageCompareResultNode(source: AppNode, result: RunResult): void {
  const images = (result.contentUrls?.length ? result.contentUrls : [result.contentUrl]).filter(
    (url): url is string => !!url,
  );
  if (images.length === 0) return;
  const state = useCanvas.getState();
  const compareNode = createImageCompareNode(images, { x: 0, y: 0 });
  const pos = getResultNodePosition(
    source,
    state.nodes,
    state.edges,
    'image-compare',
    compareNode.width,
    compareNode.height,
  );
  compareNode.x = pos.x;
  compareNode.y = pos.y;
  state.addNode(compareNode);
  state.addEdge({ id: edgeId(), from: source.id, to: compareNode.id });
  state.setSelection([source.id, compareNode.id]);
}

function createVideoPreviewResultNode(source: AppNode, result: RunResult): void {
  if (!result.contentUrl) return;
  const state = useCanvas.getState();
  const hasPreview = state.edges.some((edge) => {
    if (edge.from !== source.id) return false;
    const target = state.nodes.find((node) => node.id === edge.to);
    return (
      target?.kind === 'preview' &&
      target.settings.previewType === 'video' &&
      target.settings.content === result.contentUrl
    );
  });
  if (hasPreview) return;

  const previewNode = createVideoPreviewNode(result.contentUrl, { x: 0, y: 0 });
  const pos = getResultNodePosition(
    source,
    state.nodes,
    state.edges,
    'preview',
    previewNode.width,
    previewNode.height,
  );
  previewNode.x = pos.x;
  previewNode.y = pos.y;
  state.addNode(previewNode);
  state.addEdge({ id: edgeId(), from: source.id, to: previewNode.id });
  state.setSelection([source.id, previewNode.id]);
}

function isPersistableKind(kind: string): boolean {
  return (
    kind === 'gen-image' ||
    kind === 'direct-final-render' ||
    kind === 'gen-video' ||
    kind === 'generate-character-image' ||
    kind === 'generate-scene-image' ||
    kind === 'generate-character-video' ||
    kind === 'generate-scene-video'
  );
}
