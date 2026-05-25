import { useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getModelDisplayName } from '@/api/models';
import {
  FEATURE_DISABLED_MESSAGE,
  isNodeFeatureEnabled,
} from '@/config/features';
import { useGenerationTrigger } from '@/hooks/useGenerationTrigger';
import { useModels } from '@/hooks/useModels';
import { useUpstream } from '@/hooks/useUpstream';
import { useCanvas } from '@/store/canvas';
import { useNodeTask } from '@/store/tasks';
import type { GenVideoNode as GenVideoNodeT, NodeId } from '@/types/node';
import {
  firstAllowedVideoValue,
  videoDurationOptions,
  videoRatioOptions,
  videoResolutionOptions,
} from '@/utils/videoModelOptions';
import { frameClass, NODE_BODY, NODE_HEADER } from './shared';

function isWan27I2V(model: string): boolean {
  const name = model.toLowerCase();
  return name.startsWith('wan2.7') && name.includes('i2v');
}

function isHappyHorse(model: string): boolean {
  return model.toLowerCase().startsWith('happyhorse-1.0-');
}

export function GenVideoNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const VIDEO_MODELS = useModels('video');
  const node = useCanvas(
    (s) => s.nodes.find((n) => n.id === nid) as GenVideoNodeT | undefined,
  );
  const patchSettings = useCanvas((s) => s.patchSettings);
  const upstream = useUpstream(nid);
  const task = useNodeTask(nid);
  const trigger = useGenerationTrigger();
  const isBusy = task?.status === 'pending' || task?.status === 'running';
  const currentSettings = node?.kind === 'gen-video' ? node.settings : undefined;
  const selectedModel = currentSettings
    ? VIDEO_MODELS.find((m) => m.id === currentSettings.model)
    : undefined;
  const durationOptions = videoDurationOptions(selectedModel);
  const ratioOptions = videoRatioOptions(selectedModel);
  const resolutionOptions = videoResolutionOptions(selectedModel);

  useEffect(() => {
    if (!node || node.kind !== 'gen-video' || isBusy) return;
    const nextDuration = firstAllowedVideoValue(node.settings.duration, durationOptions, '5s');
    const nextRatio = firstAllowedVideoValue(node.settings.ratio, ratioOptions, '16:9');
    const nextResolution = firstAllowedVideoValue(
      node.settings.resolution,
      resolutionOptions,
      '720p',
    );
    if (
      nextDuration !== node.settings.duration ||
      nextRatio !== node.settings.ratio ||
      nextResolution !== node.settings.resolution
    ) {
      patchSettings<'gen-video'>(nid, {
        duration: nextDuration,
        ratio: nextRatio,
        resolution: nextResolution,
      });
    }
  }, [durationOptions, isBusy, nid, node, patchSettings, ratioOptions, resolutionOptions]);

  if (!node || node.kind !== 'gen-video') return null;
  const settings = node.settings;
  const refs = upstream.referenceImages;
  const omniDisabled = isWan27I2V(settings.model);
  const firstLastDisabled = isHappyHorse(settings.model);
  const videoMode =
    omniDisabled && settings.videoMode === 'omni-reference'
      ? 'first-last-frame'
      : firstLastDisabled && settings.videoMode === 'first-last-frame'
        ? 'omni-reference'
        : (settings.videoMode ?? 'omni-reference');
  const modeHint =
    videoMode === 'first-last-frame'
      ? `首尾帧 - ${Math.min(refs.length, 2)}/2`
      : `全能参考 - ${refs.length}${upstream.videoUrl ? ' + 视频' : ''}${
          upstream.audioUrls.length > 0 ? ' + 音频' : ''
        }`;
  const disabled = !isNodeFeatureEnabled(node.kind);

  return (
    <div className={frameClass(selected)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className={NODE_HEADER}>
        <span>视频生成</span>
        <span className="ml-auto truncate text-zinc-400">
          {selectedModel ? getModelDisplayName(selectedModel) : settings.model}
        </span>
      </div>
      <div className={`${NODE_BODY} flex flex-col gap-1.5 overflow-y-auto px-2 py-1.5`}>
        <select
          className="nodrag rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs"
          value={settings.model}
          onChange={(e) =>
            patchSettings<'gen-video'>(nid, {
              model: e.target.value,
              videoMode: isWan27I2V(e.target.value)
                ? 'first-last-frame'
                : isHappyHorse(e.target.value)
                  ? 'omni-reference'
                  : videoMode,
            })
          }
          disabled={isBusy}
        >
          {VIDEO_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {getModelDisplayName(m)}
            </option>
          ))}
        </select>
        <textarea
          className="nodrag h-16 resize-none rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs"
          placeholder={upstream.prompt ? `(上游 prompt: ${upstream.prompt})` : 'video prompt'}
          value={settings.videoPrompt}
          onChange={(e) => patchSettings<'gen-video'>(nid, { videoPrompt: e.target.value })}
          disabled={isBusy}
        />
        <div className="grid grid-cols-2 gap-1 rounded border border-zinc-200 bg-zinc-50 p-1">
          <button
            type="button"
            className={`nodrag rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              firstLastDisabled
                ? 'cursor-not-allowed text-zinc-400'
                : videoMode === 'first-last-frame'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-zinc-600 hover:bg-white'
            }`}
            onClick={() =>
              !firstLastDisabled &&
              patchSettings<'gen-video'>(nid, { videoMode: 'first-last-frame' })
            }
            disabled={isBusy || firstLastDisabled}
            title={firstLastDisabled ? 'HappyHorse 不支持首尾帧模式' : undefined}
          >
            首尾帧
          </button>
          <button
            type="button"
            className={`nodrag rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              omniDisabled
                ? 'cursor-not-allowed text-zinc-400'
                : videoMode === 'omni-reference'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-zinc-600 hover:bg-white'
            }`}
            onClick={() =>
              !omniDisabled &&
              patchSettings<'gen-video'>(nid, {
                videoMode: 'omni-reference',
              })
            }
            disabled={isBusy || omniDisabled}
            title={omniDisabled ? 'wan2.7-i2v 不支持全能参考多图，请使用可灵模型' : undefined}
          >
            全能参考
          </button>
        </div>
        {omniDisabled && (
          <div className="rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-700">
            wan2.7-i2v 不支持全能参考多图，已禁用该模式
          </div>
        )}
        {firstLastDisabled && (
          <div className="rounded bg-amber-50 px-1.5 py-1 text-[11px] text-amber-700">
            HappyHorse 不支持首尾帧模式，已切换为全能参考
          </div>
        )}
        <div className="flex gap-1">
          <select
            className="nodrag flex-1 rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px]"
            value={String(settings.duration ?? '5s')}
            onChange={(e) => patchSettings<'gen-video'>(nid, { duration: e.target.value })}
            disabled={isBusy}
          >
            {durationOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="nodrag flex-1 rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px]"
            value={settings.ratio ?? '16:9'}
            onChange={(e) => patchSettings<'gen-video'>(nid, { ratio: e.target.value })}
            disabled={isBusy}
          >
            {ratioOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="nodrag flex-1 rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px]"
            value={settings.resolution ?? '720p'}
            onChange={(e) => patchSettings<'gen-video'>(nid, { resolution: e.target.value })}
            disabled={isBusy}
          >
            {resolutionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {(refs.length > 0 || upstream.audioUrls.length > 0) && (
          <div className="flex flex-col gap-1 rounded border border-zinc-200 bg-zinc-50 p-1">
            {refs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {refs.slice(0, videoMode === 'first-last-frame' ? 2 : 5).map((url, i) => (
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded border border-zinc-200 object-cover"
                    draggable={false}
                  />
                ))}
              </div>
            )}
            {upstream.audioUrls.length > 0 && (
              <div className="flex flex-col gap-1">
                {upstream.audioUrls.slice(0, 3).map((url, i) => (
                  <audio
                    key={`${url}-${i}`}
                    src={url}
                    controls
                    className="nodrag h-8 w-full"
                  />
                ))}
              </div>
            )}
            <span className="text-[11px] text-zinc-400">{modeHint}</span>
          </div>
        )}
        {refs.length === 0 && upstream.audioUrls.length === 0 && (
          <div className="rounded bg-zinc-50 px-1.5 py-1 text-[11px] text-zinc-500">
            {videoMode === 'first-last-frame'
              ? '连接 2 张图片作为首帧和尾帧'
              : '可连接图片或视频输入作为参考'}
          </div>
        )}
        {task?.error && (
          <div className="rounded bg-red-50 px-1.5 py-1 text-[11px] text-red-700">
            {task.error}
          </div>
        )}
        {disabled && (
          <div className="rounded bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-700">
            {FEATURE_DISABLED_MESSAGE}
          </div>
        )}
        <button
          type="button"
          className="nodrag rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={disabled || isBusy}
          title={disabled ? FEATURE_DISABLED_MESSAGE : '生成视频'}
          onClick={() => trigger(nid)}
        >
          {isBusy ? '生成中...' : '生成视频'}
        </button>
      </div>
    </div>
  );
}
