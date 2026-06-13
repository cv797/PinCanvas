import { type NodeProps } from '@xyflow/react';
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  ImageIcon,
  LayoutTemplate,
  ListChecks,
  MessageSquareText,
  Sparkles,
  Upload,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_IMAGE_MODEL, normalizeImageModelId } from '@/api/upstream';
import { createNode } from '@/canvas/factory';
import { useGenerationTrigger } from '@/hooks/useGenerationTrigger';
import { useModels } from '@/hooks/useModels';
import { useCanvas } from '@/store/canvas';
import { useNodeTask } from '@/store/tasks';
import type {
  DirectFinalAnalysisNode,
  DirectFinalDetailPromptNode,
  DirectFinalGateNode,
  DirectFinalMainPromptNode,
  DirectFinalRenderNode,
  DirectFinalReviewNode,
  DirectFinalUploadNode,
  NodeId,
} from '@/types/node';
import {
  DIRECT_FINAL_DETAIL_MODULES,
  DIRECT_FINAL_MAIN_IMAGE_SLOTS,
  type CommercialBrief,
  type DirectFinalAsset,
  type DirectFinalDetailModuleCode,
  type DirectFinalTextBlock,
  type SellingReasonCard,
} from '@/types/direct-final';
import { ImageLightbox } from '@/components/ImageLightbox';
import { fileToDataURL } from '@/utils/image';
import { edgeId } from '@/utils/id';
import { collectDirectFinalGraphContext, findDirectFinalSourceNodeIds } from '@/lib/direct-final/graph';
import { buildRiskSummary, refreshCommercialBriefStale, normalizeCommercialBriefForSave, normalizeSellingReasonForSave } from '@/lib/direct-final/validation';
import { getDetailModuleGoal, getMainSlotGoal } from '@/lib/direct-final/prompts';
import { frameClass, NODE_BODY, NODE_HEADER } from './shared';

const MAX_IMAGE_NODE_SIDE = 360;
const MIN_IMAGE_NODE_SIDE = 150;
const DIRECT_FINAL_RENDER_MAX_COUNT = 9;

export function DirectFinalUploadNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const node = useCanvas(
    (s) => s.nodes.find((item) => item.id === nid) as DirectFinalUploadNode | undefined,
  );
  const patchSettings = useCanvas((s) => s.patchSettings);
  const resizeNode = useCanvas((s) => s.resizeNode);
  const inputRef = useRef<HTMLInputElement>(null);

  const setImage = useCallback(
    async (file: File) => {
      const dataUrl = await fileToDataURL(file);
      const size = await getImageSize(dataUrl);
      patchSettings<'direct-final-upload'>(nid, {
        content: dataUrl,
        filename: file.name,
        width: size.width,
        height: size.height,
      });
      const fitted = fitImageNodeSize(size.width, size.height);
      resizeNode(nid, fitted.width, fitted.height + 72);
    },
    [nid, patchSettings, resizeNode],
  );

  if (!node || node.kind !== 'direct-final-upload') return null;
  const hasImage = !!node.settings.content;

  return (
    <div
      className={frameClass(selected)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) void setImage(file);
      }}
    >
      <div className={NODE_HEADER}>
        <ImageIcon className="h-3 w-3" />
        <span>成图源图</span>
        <span className="ml-auto truncate text-zinc-400">{node.settings.filename ?? ''}</span>
      </div>
      <div className={`${NODE_BODY} flex flex-col gap-2 p-2`}>
        {hasImage ? (
          <img
            src={node.settings.content}
            alt={node.settings.filename ?? ''}
            className="min-h-0 flex-1 rounded-lg object-contain"
            draggable={false}
          />
        ) : (
          <button
            type="button"
            className="nodrag flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-zinc-400"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            点击 / 拖入商品源图
          </button>
        )}
        <input
          className="nodrag rounded border border-zinc-200 px-2 py-1 text-xs"
          placeholder="图片角色：包装 / 内容物 / 细节"
          value={node.settings.roleName ?? ''}
          onChange={(event) =>
            patchSettings<'direct-final-upload'>(nid, { roleName: event.target.value })
          }
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void setImage(file);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function DirectFinalAnalysisNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const node = useCanvas(
    (s) => s.nodes.find((item) => item.id === nid) as DirectFinalAnalysisNode | undefined,
  );
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const patchSettings = useCanvas((s) => s.patchSettings);
  const trigger = useGenerationTrigger();
  const task = useNodeTask(nid);
  const chatModels = useModels('chat');
  const context = useMemo(() => collectDirectFinalGraphContext(nid, nodes, edges), [nid, nodes, edges]);
  const isBusy = task?.status === 'pending' || task?.status === 'running' || node?.settings.isGenerating;

  useEffect(() => {
    if (!node?.settings.brief) return;
    const refreshed = refreshCommercialBriefStale(node.settings.brief, context.sourceImages);
    if (refreshed && refreshed !== node.settings.brief) {
      patchSettings<'direct-final-analysis'>(nid, { brief: refreshed });
    }
  }, [context.sourceImages, nid, node?.settings.brief, patchSettings]);

  if (!node || node.kind !== 'direct-final-analysis') return null;
  const brief = node.settings.brief;
  const confirmed = !!brief?.confirmedAt && !brief.isStale;

  const updateBrief = (patch: Partial<CommercialBrief>) => {
    if (!brief) return;
    patchSettings<'direct-final-analysis'>(nid, { brief: { ...brief, ...patch, hasManualEdits: true } });
  };

  return (
    <div className={frameClass(selected)}>
      <div className={NODE_HEADER}>
        <ClipboardList className="h-3 w-3" />
        <span>商业分析</span>
        <span className="ml-auto truncate text-zinc-400">{confirmed ? '已确认' : '草稿'}</span>
      </div>
      <div className={`${NODE_BODY} space-y-2 overflow-y-auto p-2 text-xs`}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="nodrag min-w-0 rounded border border-zinc-200 bg-white px-2 py-1"
            value={node.settings.model}
            disabled={!!isBusy}
            onChange={(event) =>
              patchSettings<'direct-final-analysis'>(nid, { model: event.target.value })
            }
          >
            {chatModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nodrag rounded bg-zinc-900 px-2 py-1 font-medium text-white disabled:bg-zinc-300"
            disabled={!!isBusy || context.sourceImages.length === 0}
            onClick={() => {
              patchSettings<'direct-final-analysis'>(nid, { action: 'brief', error: null });
              trigger(nid);
            }}
          >
            {isBusy ? '生成中' : '生成'}
          </button>
        </div>

        {context.sourceImages.length === 0 && (
          <Notice tone="warn">请先连接成图源图节点。</Notice>
        )}
        {brief?.isStale && <Notice tone="warn">源图发生变化，请重新生成或确认沿用。</Notice>}
        {node.settings.error && <Notice tone="error">{node.settings.error}</Notice>}

        {brief ? (
          <div className="space-y-1.5">
            <Field label="品牌">
              <input
                className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
                value={brief.brandName}
                onChange={(event) => updateBrief({ brandName: event.target.value })}
              />
            </Field>
            <Field label="公司">
              <input
                className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
                value={brief.companyName}
                onChange={(event) => updateBrief({ companyName: event.target.value })}
              />
            </Field>
            <Field label="产品类型">
              <select
                className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
                value={brief.productType}
                onChange={(event) =>
                  updateBrief({ productType: event.target.value as CommercialBrief['productType'] })
                }
              >
                <option value="food">普通食品</option>
                <option value="blue-cap-health">蓝帽保健食品</option>
                <option value="sports">运动器材</option>
                <option value="other">其他</option>
              </select>
            </Field>
            <Field label="SKU">
              <input
                className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
                value={brief.skuList.join(' / ')}
                onChange={(event) =>
                  updateBrief({
                    skuList: event.target.value
                      .split(/[\/,，\n]/u)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label="主图文案">
              <textarea
                className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
                value={brief.copyDraft}
                onChange={(event) => updateBrief({ copyDraft: event.target.value })}
              />
            </Field>
            <Field label="目标人群">
              <textarea
                className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
                value={brief.targetAudienceNotes}
                onChange={(event) => updateBrief({ targetAudienceNotes: event.target.value })}
              />
            </Field>
            <Field label="市场备注">
              <textarea
                className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
                value={brief.marketNotes}
                onChange={(event) => updateBrief({ marketNotes: event.target.value })}
              />
            </Field>
            {brief.missingFields.length > 0 && (
              <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">
                缺失字段：{brief.missingFields.join(' / ')}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="nodrag rounded bg-blue-600 px-2 py-1.5 font-medium text-white hover:bg-blue-700"
                onClick={() => {
                  const savedBrief = normalizeCommercialBriefForSave(brief, context.sourceImages);
                  patchSettings<'direct-final-analysis'>(nid, {
                    brief: savedBrief,
                    risk: buildRiskSummary(savedBrief, context.sourceImages),
                  });
                }}
              >
                确认分析
              </button>
              <button
                type="button"
                className="nodrag rounded bg-zinc-900 px-2 py-1.5 font-medium text-white disabled:bg-zinc-300"
                disabled={!confirmed || !!isBusy}
                onClick={() => {
                  patchSettings<'direct-final-analysis'>(nid, { action: 'gates', error: null });
                  trigger(nid);
                }}
              >
                生成门禁
              </button>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Sparkles className="h-5 w-5" />} text="生成商业输入后会显示可编辑字段。" />
        )}
      </div>
    </div>
  );
}

export function DirectFinalGateNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const node = useCanvas(
    (s) => s.nodes.find((item) => item.id === nid) as DirectFinalGateNode | undefined,
  );
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const setSelection = useCanvas((s) => s.setSelection);
  const patchSettings = useCanvas((s) => s.patchSettings);
  const context = useMemo(() => collectDirectFinalGraphContext(nid, nodes, edges), [nid, nodes, edges]);

  if (!node || node.kind !== 'direct-final-gate') return null;
  const card = node.settings.card;
  const confirmed = !!card?.confirmedAt;

  const updateCard = (patch: Partial<SellingReasonCard>) => {
    if (!card) return;
    patchSettings<'direct-final-gate'>(nid, { card: { ...card, ...patch, hasManualEdits: true } });
  };

  const createPromptChains = (chainKind: 'main' | 'detail') => {
    if (!confirmed) return;
    const state = useCanvas.getState();
    const sourceIds = findDirectFinalSourceNodeIds(nid, state.nodes, state.edges);
    const created: NodeId[] = [];
    const count = Math.max(1, Math.min(5, node.settings.mainPromptCount ?? 2));
    let index = 0;

    const addChain = (kind: 'direct-final-main-prompt' | 'direct-final-detail-prompt', config: { slot?: number; moduleCode?: DirectFinalDetailModuleCode }) => {
      const prompt = createNode(kind, { x: node.x + 420, y: node.y + index * 180 });
      if (prompt.kind === 'direct-final-main-prompt' && config.slot) {
        prompt.settings.slot = config.slot as DirectFinalMainPromptNode['settings']['slot'];
        prompt.settings.copyLanguage = context.analysisNode?.settings.copyLanguage ?? 'zh-CN';
      }
      if (prompt.kind === 'direct-final-detail-prompt' && config.moduleCode) {
        prompt.settings.moduleCode = config.moduleCode;
        prompt.settings.copyLanguage = context.analysisNode?.settings.copyLanguage ?? 'zh-CN';
      }
      const render = createNode('direct-final-render', { x: prompt.x + 430, y: prompt.y });
      const review = createNode('direct-final-review', { x: render.x + 450, y: render.y });
      if (render.kind === 'direct-final-render') {
        render.settings.copyLanguage = context.analysisNode?.settings.copyLanguage ?? 'zh-CN';
        if (kind === 'direct-final-detail-prompt') {
          render.settings.ratio = '3:4';
          render.settings.width = 768;
          render.settings.height = 1024;
          render.settings.resolution = '768x1024';
        }
      }
      if (review.kind === 'direct-final-review') {
        review.settings.copyLanguage = context.analysisNode?.settings.copyLanguage ?? 'zh-CN';
      }
      state.addNode(prompt);
      state.addNode(render);
      state.addNode(review);
      state.addEdge({ id: edgeId(), from: nid, to: prompt.id });
      state.addEdge({ id: edgeId(), from: prompt.id, to: render.id });
      state.addEdge({ id: edgeId(), from: render.id, to: review.id });
      state.addEdge({ id: edgeId(), from: prompt.id, to: review.id });
      for (const sourceId of sourceIds) {
        state.addEdge({ id: edgeId(), from: sourceId, to: render.id });
        state.addEdge({ id: edgeId(), from: sourceId, to: review.id });
      }
      created.push(prompt.id, render.id, review.id);
      index += 1;
    };

    if (chainKind === 'main') {
      for (let slot = 1; slot <= count; slot += 1) {
        addChain('direct-final-main-prompt', { slot: slot as DirectFinalMainPromptNode['settings']['slot'] });
      }
    } else {
      const moduleCodes = DIRECT_FINAL_DETAIL_MODULES.slice(0, count).map((item) => item.code);
      for (const moduleCode of moduleCodes) {
        addChain('direct-final-detail-prompt', { moduleCode });
      }
    }
    setSelection(created);
  };

  return (
    <div className={frameClass(selected)}>
      <div className={NODE_HEADER}>
        <ListChecks className="h-3 w-3" />
        <span>门禁</span>
        <span className="ml-auto truncate text-zinc-400">{confirmed ? '已确认' : '待确认'}</span>
      </div>
      <div className={`${NODE_BODY} space-y-2 overflow-y-auto p-2 text-xs`}>
        {node.settings.error && <Notice tone="error">{node.settings.error}</Notice>}
        {card ? (
          <>
            <Field label="目标人群">
              <input className="nodrag w-full rounded border border-zinc-200 px-2 py-1" value={card.targetAudience} onChange={(event) => updateCard({ targetAudience: event.target.value })} />
            </Field>
            <Field label="痛点">
              <textarea className="nodrag h-14 w-full resize-none rounded border border-zinc-200 px-2 py-1" value={card.painPoint} onChange={(event) => updateCard({ painPoint: event.target.value })} />
            </Field>
            <Field label="方案">
              <textarea className="nodrag h-14 w-full resize-none rounded border border-zinc-200 px-2 py-1" value={card.solution} onChange={(event) => updateCard({ solution: event.target.value })} />
            </Field>
            <Field label="利益翻译">
              <textarea className="nodrag h-14 w-full resize-none rounded border border-zinc-200 px-2 py-1" value={card.benefitTranslation} onChange={(event) => updateCard({ benefitTranslation: event.target.value })} />
            </Field>
            <Field label="场景偏好">
              <input className="nodrag w-full rounded border border-zinc-200 px-2 py-1" value={card.scenePreference} onChange={(event) => updateCard({ scenePreference: event.target.value })} />
            </Field>
            <Field label="信任证据">
              <input className="nodrag w-full rounded border border-zinc-200 px-2 py-1" value={card.trustEvidence} onChange={(event) => updateCard({ trustEvidence: event.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="nodrag rounded bg-blue-600 px-2 py-1.5 font-medium text-white"
                onClick={() => patchSettings<'direct-final-gate'>(nid, { card: normalizeSellingReasonForSave(card) })}
              >
                确认门禁
              </button>
              <button
                type="button"
                className="nodrag rounded bg-zinc-900 px-2 py-1.5 font-medium text-white disabled:bg-zinc-300"
                disabled={!confirmed}
                onClick={() => createPromptChains('main')}
              >
                主图链路
              </button>
              <button
                type="button"
                className="nodrag rounded bg-zinc-900 px-2 py-1.5 font-medium text-white disabled:bg-zinc-300"
                disabled={!confirmed}
                onClick={() => createPromptChains('detail')}
              >
                详情链路
              </button>
            </div>
            <PromptChainOptions node={node} />
          </>
        ) : (
          <EmptyState icon={<ListChecks className="h-5 w-5" />} text="从商业分析节点生成门禁卡。" />
        )}
      </div>
    </div>
  );
}

function PromptChainOptions({ node }: { node: DirectFinalGateNode }) {
  const patchSettings = useCanvas((s) => s.patchSettings);
  return (
    <div className="space-y-2 rounded border border-zinc-100 bg-zinc-50 p-2">
      <label className="flex items-center justify-between gap-2">
        <span className="text-zinc-500">链路数量</span>
        <input
          className="nodrag w-16 rounded border border-zinc-200 px-2 py-1 text-right"
          type="number"
          min={1}
          max={5}
          value={node.settings.mainPromptCount ?? 2}
          onChange={(event) =>
            patchSettings<'direct-final-gate'>(node.id, {
              mainPromptCount: Math.max(1, Math.min(5, Number(event.target.value) || 1)),
            })
          }
        />
      </label>
    </div>
  );
}

export function DirectFinalMainPromptNodeComp(props: NodeProps) {
  return <DirectFinalPromptNode {...props} kind="main" />;
}

export function DirectFinalDetailPromptNodeComp(props: NodeProps) {
  return <DirectFinalPromptNode {...props} kind="detail" />;
}

function DirectFinalPromptNode({ id, selected, kind }: NodeProps & { kind: 'main' | 'detail' }) {
  const nid = id as NodeId;
  const node = useCanvas((s) =>
    s.nodes.find((item) => item.id === nid),
  ) as DirectFinalMainPromptNode | DirectFinalDetailPromptNode | undefined;
  const patchSettings = useCanvas((s) => s.patchSettings);
  const trigger = useGenerationTrigger();
  const task = useNodeTask(nid);
  const chatModels = useModels('chat');
  const isBusy = task?.status === 'pending' || task?.status === 'running' || node?.settings.isGenerating;

  if (
    !node ||
    (kind === 'main' && node.kind !== 'direct-final-main-prompt') ||
    (kind === 'detail' && node.kind !== 'direct-final-detail-prompt')
  ) {
    return null;
  }
  const asset = node.settings.asset;
  const updateAsset = (patch: Partial<DirectFinalAsset>) => {
    if (!asset) return;
    const next: DirectFinalAsset = { ...asset, ...patch, selfReviewScore: null };
    if (node.kind === 'direct-final-main-prompt') {
      patchSettings<'direct-final-main-prompt'>(nid, { asset: next });
    } else {
      patchSettings<'direct-final-detail-prompt'>(nid, { asset: next });
    }
  };
  const title =
    node.kind === 'direct-final-main-prompt'
      ? `主图 ${node.settings.slot}`
      : `详情 ${node.settings.moduleCode}`;
  const goal =
    node.kind === 'direct-final-main-prompt'
      ? getMainSlotGoal(node.settings.slot)
      : getDetailModuleGoal(node.settings.moduleCode);

  return (
    <div className={frameClass(selected)}>
      <div className={NODE_HEADER}>
        <FileText className="h-3 w-3" />
        <span>{title}</span>
        <span className="ml-auto truncate text-zinc-400">{asset ? '脚本已生成' : goal}</span>
      </div>
      <div className={`${NODE_BODY} space-y-2 overflow-y-auto p-2 text-xs`}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="nodrag min-w-0 rounded border border-zinc-200 bg-white px-2 py-1"
            value={node.settings.model}
            disabled={!!isBusy}
            onChange={(event) => {
              if (node.kind === 'direct-final-main-prompt') {
                patchSettings<'direct-final-main-prompt'>(nid, { model: event.target.value });
              } else {
                patchSettings<'direct-final-detail-prompt'>(nid, { model: event.target.value });
              }
            }}
          >
            {chatModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nodrag rounded bg-zinc-900 px-2 py-1 font-medium text-white disabled:bg-zinc-300"
            disabled={!!isBusy}
            onClick={() => trigger(nid)}
          >
            {isBusy ? '生成中' : '生成脚本'}
          </button>
        </div>
        <Field label={node.kind === 'direct-final-main-prompt' ? '脚本位置' : '详情模块'}>
          {node.kind === 'direct-final-main-prompt' ? (
            <select
              className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
              value={node.settings.slot}
              disabled={!!isBusy}
              onChange={(event) =>
                patchSettings<'direct-final-main-prompt'>(nid, {
                  slot: Number(event.target.value) as DirectFinalMainPromptNode['settings']['slot'],
                })
              }
            >
              {DIRECT_FINAL_MAIN_IMAGE_SLOTS.map((item) => (
                <option key={item.slot} value={item.slot}>
                  {item.slot}. {item.goal}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="nodrag w-full rounded border border-zinc-200 px-2 py-1"
              value={node.settings.moduleCode}
              disabled={!!isBusy}
              onChange={(event) =>
                patchSettings<'direct-final-detail-prompt'>(nid, {
                  moduleCode: event.target.value as DirectFinalDetailPromptNode['settings']['moduleCode'],
                })
              }
            >
              {DIRECT_FINAL_DETAIL_MODULES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code}. {item.goal}
                </option>
              ))}
            </select>
          )}
        </Field>
        {node.settings.error && <Notice tone="error">{node.settings.error}</Notice>}
        {asset ? (
          <div className="space-y-2">
            <EditableAssetFields asset={asset} onChange={updateAsset} />
            {asset.selfReviewScore !== null && (
              <InfoBlock label="本地自审" value={`${asset.selfReviewScore}/100`} />
            )}
          </div>
        ) : (
          <EmptyState icon={<MessageSquareText className="h-5 w-5" />} text="生成后这里会显示结构化成图脚本。" />
        )}
      </div>
    </div>
  );
}

function EditableAssetFields({
  asset,
  onChange,
}: {
  asset: DirectFinalAsset;
  onChange: (patch: Partial<DirectFinalAsset>) => void;
}) {
  return (
    <div className="space-y-2">
      <Field label="目标">
        <textarea
          className="nodrag h-14 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.goal}
          onChange={(event) => onChange({ goal: event.target.value })}
        />
      </Field>
      <Field label="画面">
        <textarea
          className="nodrag h-20 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.visualContent}
          onChange={(event) => onChange({ visualContent: event.target.value })}
        />
      </Field>
      <Field label="图内文案摘要">
        <textarea
          className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.inImageCopy}
          onChange={(event) => onChange({ inImageCopy: event.target.value })}
        />
      </Field>
      <Field label="图内文案块（每行一个）">
        <textarea
          className="nodrag h-20 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={textBlocksToLines(asset.textBlocks)}
          onChange={(event) =>
            onChange({ textBlocks: linesToTextBlocks(event.target.value, asset.textBlocks) })
          }
        />
      </Field>
      <Field label="设计备注">
        <textarea
          className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.designNotes}
          onChange={(event) => onChange({ designNotes: event.target.value })}
        />
      </Field>
      <Field label="合规备注">
        <textarea
          className="nodrag h-16 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.complianceNotes}
          onChange={(event) => onChange({ complianceNotes: event.target.value })}
        />
      </Field>
      <Field label="负面约束（每行一条）">
        <textarea
          className="nodrag h-20 w-full resize-none rounded border border-zinc-200 px-2 py-1"
          value={asset.negativeConstraints.join('\n')}
          onChange={(event) => onChange({ negativeConstraints: splitNonEmptyLines(event.target.value) })}
        />
      </Field>
    </div>
  );
}

function textBlocksToLines(blocks: DirectFinalTextBlock[]): string {
  return blocks.map((block) => block.content).join('\n');
}

function linesToTextBlocks(value: string, previous: DirectFinalTextBlock[]): DirectFinalTextBlock[] {
  const lines = splitNonEmptyLines(value);
  return lines.map((content, index) => {
    const existing = previous[index];
    return existing
      ? { ...existing, content }
      : { role: 'bullet', content, maxLines: 1 };
  });
}

function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function clampDirectFinalRenderCount(value: number | string | undefined): number {
  const parsed = Math.round(Number(value ?? 1));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(DIRECT_FINAL_RENDER_MAX_COUNT, Math.max(1, parsed));
}

export function DirectFinalRenderNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const node = useCanvas(
    (s) => s.nodes.find((item) => item.id === nid) as DirectFinalRenderNode | undefined,
  );
  const patchSettings = useCanvas((s) => s.patchSettings);
  const trigger = useGenerationTrigger();
  const task = useNodeTask(nid);
  const imageModels = useModels('image');
  const isBusy = task?.status === 'pending' || task?.status === 'running' || node?.settings.isGenerating;

  if (!node || node.kind !== 'direct-final-render') return null;
  const normalizedModel = normalizeImageModelId(node.settings.model || DEFAULT_IMAGE_MODEL);
  const count = clampDirectFinalRenderCount(node.settings.count);
  const resultImages =
    node.generatedImages && node.generatedImages.length > 0
      ? node.generatedImages
      : node.content
        ? [node.content]
        : [];
  const firstResultImage = resultImages[0];

  return (
    <div className={frameClass(selected)}>
      <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <div className={NODE_HEADER}>
        <LayoutTemplate className="h-3 w-3" />
        <span>成图执行</span>
        <span className="ml-auto truncate text-zinc-400">
          {normalizedModel} · {count}张
        </span>
      </div>
      <div className={`${NODE_BODY} flex flex-col gap-2 p-2 text-xs`}>
        {resultImages.length > 1 ? (
          <DirectFinalImageGrid images={resultImages} onPreview={setLightboxUrl} />
        ) : firstResultImage ? (
          <button
            type="button"
            className="nodrag min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-50"
            onClick={() => setLightboxUrl(firstResultImage)}
            title="点击查看大图"
          >
            <img src={firstResultImage} alt="" className="h-full w-full object-contain" draggable={false} />
          </button>
        ) : (
          <EmptyState icon={<ImageIcon className="h-5 w-5" />} text="连接源图和脚本节点后生成最终图。" />
        )}
        <div className="grid grid-cols-[1fr_72px_auto] gap-2">
          <select
            className="nodrag min-w-0 rounded border border-zinc-200 bg-white px-2 py-1"
            value={normalizedModel}
            disabled={!!isBusy}
            onChange={(event) =>
              patchSettings<'direct-final-render'>(nid, { model: event.target.value })
            }
          >
            {imageModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
          <input
            className="nodrag rounded border border-zinc-200 px-2 py-1 text-right"
            type="number"
            min={1}
            max={DIRECT_FINAL_RENDER_MAX_COUNT}
            value={count}
            title="生成张数"
            disabled={!!isBusy}
            onChange={(event) =>
              patchSettings<'direct-final-render'>(nid, {
                count: clampDirectFinalRenderCount(event.target.value),
              })
            }
          />
          <button
            type="button"
            className="nodrag rounded bg-zinc-900 px-2 py-1 font-medium text-white disabled:bg-zinc-300"
            disabled={!!isBusy}
            onClick={() => trigger(nid)}
          >
            {isBusy ? '生成中' : '生成图'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="nodrag rounded border border-zinc-200 px-2 py-1"
            value={node.settings.ratio ?? '1:1'}
            onChange={(event) => patchSettings<'direct-final-render'>(nid, { ratio: event.target.value })}
          />
          <input
            className="nodrag rounded border border-zinc-200 px-2 py-1"
            value={node.settings.resolution ?? '1024x1024'}
            onChange={(event) =>
              patchSettings<'direct-final-render'>(nid, { resolution: event.target.value })
            }
          />
        </div>
        {node.settings.error && <Notice tone="error">{node.settings.error}</Notice>}
      </div>
    </div>
  );
}

function DirectFinalImageGrid({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (url: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 overflow-y-auto rounded-lg bg-zinc-50 p-1.5">
      {images.map((url, index) => (
        <button
          key={`${url}-${index}`}
          type="button"
          className="nodrag group relative aspect-square overflow-hidden rounded-md border border-zinc-200 bg-white"
          title="点击查看大图"
          onClick={() => onPreview(url)}
        >
          <img src={url} alt={`结果 ${index + 1}`} className="h-full w-full object-contain" draggable={false} />
          <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {index + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

export function DirectFinalReviewNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const node = useCanvas(
    (s) => s.nodes.find((item) => item.id === nid) as DirectFinalReviewNode | undefined,
  );
  const patchSettings = useCanvas((s) => s.patchSettings);
  const trigger = useGenerationTrigger();
  const task = useNodeTask(nid);
  const chatModels = useModels('chat');
  const isBusy = task?.status === 'pending' || task?.status === 'running' || node?.settings.isGenerating;

  if (!node || node.kind !== 'direct-final-review') return null;
  const review = node.settings.review;
  const scores = review
    ? [
        ['文字渲染', review.scoreInImageCopyRendered],
        ['可读性', review.scoreCopyReadability],
        ['目标对齐', review.scoreCopyGoalAlignment],
        ['合规保留', review.scoreComplianceRetained],
        ['成品感', review.scoreFinishedLook],
        ['商品保真', review.scoreProductFidelity],
      ]
    : [];

  return (
    <div className={frameClass(selected)}>
      <div className={NODE_HEADER}>
        <BadgeCheck className="h-3 w-3" />
        <span>成图复盘</span>
        <span className="ml-auto truncate text-zinc-400">{review ? '已有评分' : '待复盘'}</span>
      </div>
      <div className={`${NODE_BODY} space-y-2 overflow-y-auto p-2 text-xs`}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="nodrag min-w-0 rounded border border-zinc-200 bg-white px-2 py-1"
            value={node.settings.model}
            disabled={!!isBusy}
            onChange={(event) =>
              patchSettings<'direct-final-review'>(nid, { model: event.target.value })
            }
          >
            {chatModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nodrag rounded bg-zinc-900 px-2 py-1 font-medium text-white disabled:bg-zinc-300"
            disabled={!!isBusy}
            onClick={() => trigger(nid)}
          >
            {isBusy ? '复盘中' : 'AI 复盘'}
          </button>
        </div>
        {node.settings.error && <Notice tone="error">{node.settings.error}</Notice>}
        {review ? (
          <>
            <div className="grid grid-cols-2 gap-1">
              {scores.map(([label, value]) => (
                <div key={label} className="rounded border border-zinc-100 bg-zinc-50 px-2 py-1">
                  <div className="text-[10px] text-zinc-400">{label}</div>
                  <div className="text-sm font-semibold text-zinc-800">{value}</div>
                </div>
              ))}
            </div>
            <InfoBlock label="摘要" value={review.aiSummary} />
            <InfoBlock label="问题" value={review.issues.join('\n')} />
          </>
        ) : (
          <EmptyState icon={<BadgeCheck className="h-5 w-5" />} text="连接结果图和脚本节点后执行复盘。" />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'error'; children: ReactNode }) {
  return (
    <div
      className={`rounded px-2 py-1 text-[11px] ${
        tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 rounded border border-dashed border-zinc-200 px-4 text-center text-xs text-zinc-400">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-100 bg-zinc-50 px-2 py-1">
      <div className="mb-0.5 text-[10px] font-medium text-zinc-400">{label}</div>
      <div className="whitespace-pre-wrap text-[11px] leading-4 text-zinc-700">{value || '未填写'}</div>
    </div>
  );
}

function fitImageNodeSize(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const ratio = naturalWidth / naturalHeight;
  if (ratio >= 1) {
    const width = MAX_IMAGE_NODE_SIDE;
    return { width, height: clampSide(width / ratio) };
  }
  const height = MAX_IMAGE_NODE_SIDE;
  return { width: clampSide(height * ratio), height };
}

function clampSide(value: number): number {
  return Math.round(Math.min(MAX_IMAGE_NODE_SIDE, Math.max(MIN_IMAGE_NODE_SIDE, value)));
}

function getImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
