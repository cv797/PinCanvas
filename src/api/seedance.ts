import type { Vars } from './template';

export const SEEDANCE_MODEL_IDS = [
  'seedance-2',
  'seedance-2-fast',
  'doubao-seedance-2-0-260128',
] as const;

type VideoMode = 'first-last-frame' | 'omni-reference';

interface BuildSeedanceVideoVarsInput {
  modelName: string;
  prompt: string;
  duration?: string | number;
  ratio?: string;
  resolution?: string;
  imageUrls: string[];
  videoUrl?: string | null;
  audioUrls?: string[];
  mode: VideoMode;
}

export function isSeedanceVideoModel(modelId: string): boolean {
  return SEEDANCE_MODEL_IDS.includes(modelId as (typeof SEEDANCE_MODEL_IDS)[number]);
}

export function buildSeedanceVideoVars(input: BuildSeedanceVideoVarsInput): Vars {
  const ratio = normalizeSeedanceRatio(input.ratio);
  const resolution = normalizeSeedanceResolution(input.modelName, input.resolution);
  const imageUrls = input.imageUrls.filter(Boolean);
  const hasVideoRef = Boolean(input.videoUrl);
  const audioUrls = (input.audioUrls ?? []).filter(Boolean);
  const hasAudioRef = audioUrls.length > 0;
  const duration = clampSeedanceDuration(input.duration);
  const vars: Vars = {
    modelName: input.modelName,
    prompt: input.prompt,
    duration,
    size: seedanceSizeForRatio(ratio, resolution),
    ratio,
    resolution,
    metadata: {
      duration,
      ratio,
      resolution,
      generate_audio: true,
      content: seedanceContent(input.prompt, imageUrls, input.videoUrl, audioUrls, input.mode),
      ...(hasVideoRef ? { video_urls: [input.videoUrl] } : {}),
      ...(hasAudioRef ? { audio_urls: audioUrls, reference_audio_urls: audioUrls } : {}),
    },
  };

  if (input.mode === 'first-last-frame') {
    if (imageUrls.length < 2) {
      throw new Error('首尾帧模式需要连接至少 2 张参考图');
    }
    vars.mode = 'first_last_frame';
    vars.imageUrls = imageUrls.slice(0, 2);
    return vars;
  }

  if (hasVideoRef || hasAudioRef || imageUrls.length > 1) {
    vars.mode = 'multi_ref';
    if (imageUrls.length > 0) vars.imageUrls = imageUrls.slice(0, 9);
    return vars;
  }

  if (imageUrls.length === 1) {
    vars.mode = 'image_to_video';
    vars.primaryImageUrl = imageUrls[0];
    return vars;
  }

  vars.mode = 'text_to_video';
  return vars;
}

function seedanceContent(
  prompt: string,
  imageUrls: string[],
  videoUrl: string | null | undefined,
  audioUrls: string[],
  mode: VideoMode,
): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: prompt,
    },
  ];
  imageUrls.forEach((url, index) => {
    let role = 'reference_image';
    if (mode === 'first-last-frame') {
      role = index === 0 ? 'first_frame' : 'last_frame';
    }
    content.push({
      type: 'image_url',
      role,
      image_url: { url },
    });
  });
  if (videoUrl) {
    content.push({
      type: 'video_url',
      role: 'reference_video',
      video_url: { url: videoUrl },
    });
  }
  audioUrls.forEach((url) => {
    content.push({
      type: 'audio_url',
      role: 'reference_audio',
      audio_url: { url },
    });
  });
  return content;
}

export function normalizeSeedanceResolution(modelId: string, resolution?: string): string {
  const normalized = String(resolution ?? '720p').toLowerCase();
  const value = normalized === '720p' || normalized === '1080p' ? normalized : '720p';
  if (modelId === 'seedance-2-fast' && value === '1080p') return '720p';
  return value;
}

function normalizeSeedanceRatio(ratio?: string): string {
  const value = ratio ?? '16:9';
  if (['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].includes(value)) return value;
  return '16:9';
}

function clampSeedanceDuration(duration?: string | number): number {
  const parsed = typeof duration === 'number' ? duration : parseInt(String(duration ?? '5s'), 10);
  const value = Number.isFinite(parsed) ? parsed : 5;
  return Math.min(10, Math.max(4, value));
}

function seedanceSizeForRatio(ratio: string, resolution: string): string {
  const res = resolution.toLowerCase();
  if (ratio === '21:9') return res === '1080p' ? '2560x1080' : '1920x816';
  if (ratio === '9:16') return res === '1080p' ? '1080x1920' : '720x1280';
  if (ratio === '1:1') return res === '1080p' ? '1024x1024' : '720x720';
  if (ratio === '4:3') return res === '1080p' ? '1088x832' : '1024x768';
  if (ratio === '3:4') return res === '1080p' ? '832x1088' : '768x1024';
  return res === '1080p' ? '1920x1080' : '1280x720';
}
