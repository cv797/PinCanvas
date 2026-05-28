import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BookOpen, ImageIcon, SlidersHorizontal, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getModelDisplayName } from '@/api/models';
import { normalizeImageModelId } from '@/api/upstream';
import { FEATURE_DISABLED_MESSAGE, isNodeFeatureEnabled } from '@/config/features';
import { useGenerationTrigger } from '@/hooks/useGenerationTrigger';
import { useModels } from '@/hooks/useModels';
import { useUpstream } from '@/hooks/useUpstream';
import { useCanvas } from '@/store/canvas';
import { useNodeTask } from '@/store/tasks';
import type { GenImageNode as GenImageNodeT, NodeId } from '@/types/node';

const QUALITY_OPTIONS = ['auto', 'high', 'medium', 'low'];
const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DEFAULT_SIZE = { width: 1024, height: 1024 };
const MAX_IMAGE_NODE_SIDE = 360;
const MIN_IMAGE_NODE_SIDE = 140;
const IMAGE_PRESETS = [
  { label: '1:1', ratio: '1:1', width: 1024, height: 1024 },
  { label: '3:2', ratio: '3:2', width: 1536, height: 1024 },
  { label: '2:3', ratio: '2:3', width: 1024, height: 1536 },
  { label: '4:3', ratio: '4:3', width: 1024, height: 768 },
  { label: '3:4', ratio: '3:4', width: 768, height: 1024 },
  { label: '9:16', ratio: '9:16', width: 768, height: 1365 },
  { label: '1:1(2k)', ratio: '1:1', width: 2048, height: 2048 },
  { label: '16:9(2k)', ratio: '16:9', width: 2048, height: 1152 },
  { label: '9:16(2k)', ratio: '9:16', width: 1152, height: 2048 },
  { label: '16:9(4k)', ratio: '16:9', width: 3840, height: 2160 },
  { label: '9:16(4k)', ratio: '9:16', width: 2160, height: 3840 },
  { label: 'auto', ratio: 'auto', width: 1024, height: 1024 },
];

export function GenImageNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const IMAGE_MODELS = useModels('image');
  const node = useCanvas((s) => s.nodes.find((n) => n.id === nid) as GenImageNodeT | undefined);
  const patchSettings = useCanvas((s) => s.patchSettings);
  const resizeNode = useCanvas((s) => s.resizeNode);
  const upstream = useUpstream(nid);
  const task = useNodeTask(nid);
  const trigger = useGenerationTrigger();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRootRef = useRef<HTMLDivElement>(null);

  const isBusy = task?.status === 'pending' || task?.status === 'running';
  const disabled = node ? !isNodeFeatureEnabled(node.kind) : false;
  const normalizedModel = normalizeImageModelId(node?.settings.model ?? '');
  const selectedModel = useMemo(
    () => IMAGE_MODELS.find((model) => model.id === normalizedModel),
    [IMAGE_MODELS, normalizedModel],
  );

  const resizeToImage = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight || !node) return;
      const { width, height } = fitImageNodeSize(naturalWidth, naturalHeight);
      if (Math.abs(node.width - width) < 1 && Math.abs(node.height - height) < 1) return;
      resizeNode(nid, width, height);
    },
    [nid, node, resizeNode],
  );

  useEffect(() => {
    if (!settingsOpen) return;
    const closeSettingsOnly = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && settingsRootRef.current?.contains(target)) return;
      event.stopPropagation();
      event.preventDefault();
      setSettingsOpen(false);
    };
    window.addEventListener('pointerdown', closeSettingsOnly, true);
    return () => window.removeEventListener('pointerdown', closeSettingsOnly, true);
  }, [settingsOpen]);

  if (!node || node.kind !== 'gen-image') return null;
  const { settings } = node;
  const parsedSize = parseSize(settings.resolution);
  const imageWidth = settings.width ?? parsedSize.width ?? DEFAULT_SIZE.width;
  const imageHeight = settings.height ?? parsedSize.height ?? DEFAULT_SIZE.height;
  const quality = settings.quality ?? 'auto';
  const count = settings.count ?? 1;
  const refs = upstream.referenceImages;

  const applySize = (width: number | '', height: number | '') => {
    const nextWidth = width === '' ? '' : clampDimension(Number(width), DEFAULT_SIZE.width);
    const nextHeight = height === '' ? '' : clampDimension(Number(height), DEFAULT_SIZE.height);
    patchSettings<'gen-image'>(nid, {
      width: nextWidth,
      height: nextHeight,
      resolution: nextWidth && nextHeight ? `${nextWidth}x${nextHeight}` : settings.resolution,
    });
  };

  const applyPreset = (preset: (typeof IMAGE_PRESETS)[number]) => {
    patchSettings<'gen-image'>(nid, {
      ratio: preset.ratio,
      width: preset.width,
      height: preset.height,
      resolution: `${preset.width}x${preset.height}`,
    });
  };

  const selectedPreset = findSelectedPreset(settings.ratio, imageWidth, imageHeight);
  const settingsSummary = `${qualityLabel(quality)} / ${selectedPreset?.label ?? `${imageWidth}x${imageHeight}`} / ${count}张`;

  return (
    <div className="relative h-full w-full overflow-visible">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[22px] border border-zinc-200 bg-zinc-100 text-zinc-400 shadow-[0_18px_45px_rgba(24,24,27,0.10)]">
        {node.content ? (
          <img
            src={node.content}
            alt=""
            className="h-full w-full rounded-[20px] object-contain"
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget;
              resizeToImage(img.naturalWidth, img.naturalHeight);
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <ImageIcon className="h-7 w-7 opacity-30" />
            <span className="text-sm">图像节点</span>
          </div>
        )}
      </div>
      {selected && (
        <div
          className="nodrag absolute left-1/2 top-[calc(100%+28px)] z-[160] w-[min(560px,calc(100vw-48px))] -translate-x-1/2 rounded-[22px] border border-zinc-200 bg-white/95 p-3 shadow-[0_18px_54px_rgba(28,25,23,0.16)] backdrop-blur"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <textarea
            className="nodrag min-h-28 max-h-40 w-full resize-none rounded-[18px] border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-6 text-zinc-800 shadow-inner outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            placeholder={upstream.prompt ? `(上游 prompt: ${upstream.prompt})` : '描述要生成的图片内容'}
            value={settings.prompt}
            onChange={(event) => patchSettings<'gen-image'>(nid, { prompt: event.target.value })}
            disabled={isBusy}
          />
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-zinc-700" />
            <select
              className="h-10 min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm outline-none hover:bg-zinc-50"
              value={normalizedModel}
              onChange={(event) => patchSettings<'gen-image'>(nid, { model: event.target.value })}
              disabled={isBusy}
              title={selectedModel ? getModelDisplayName(selectedModel) : normalizedModel}
            >
              {IMAGE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {getModelDisplayName(model)}
                </option>
              ))}
            </select>
            <div ref={settingsRootRef} className="relative">
              <button
                type="button"
                className="flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-4 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-200"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {settingsSummary}
              </button>
              {settingsOpen && (
                <ImageSettingsPanel
                  quality={quality}
                  width={imageWidth}
                  height={imageHeight}
                  ratio={settings.ratio}
                  count={count}
                  onQualityChange={(next) => patchSettings<'gen-image'>(nid, { quality: next })}
                  onSizeChange={applySize}
                  onPresetChange={applyPreset}
                  onCountChange={(next) => patchSettings<'gen-image'>(nid, { count: next })}
                />
              )}
            </div>
            <button
              type="button"
              className="flex h-10 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-4 text-sm font-semibold text-zinc-500 shadow-sm hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || isBusy}
              title={disabled ? FEATURE_DISABLED_MESSAGE : '生成图片'}
              onClick={() => trigger(nid)}
            >
              <Zap className="h-4 w-4" />
              {isBusy ? '生成中' : '生成'}
            </button>
          </div>
          {(refs.length > 0 || task?.error || disabled) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              {refs.length > 0 && <span>参考图 - {refs.length}/5</span>}
              {task?.error && <span className="text-red-600">{task.error}</span>}
              {disabled && <span className="text-amber-700">{FEATURE_DISABLED_MESSAGE}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageSettingsPanel({
  quality,
  width,
  height,
  ratio,
  count,
  onQualityChange,
  onSizeChange,
  onPresetChange,
  onCountChange,
}: {
  quality: string;
  width: number | '';
  height: number | '';
  ratio?: string;
  count: number;
  onQualityChange: (quality: string) => void;
  onSizeChange: (width: number | '', height: number | '') => void;
  onPresetChange: (preset: (typeof IMAGE_PRESETS)[number]) => void;
  onCountChange: (count: number) => void;
}) {
  const selectedPreset = findSelectedPreset(ratio, width, height);
  return (
    <div
      className="absolute bottom-[calc(100%+12px)] left-1/2 z-[220] w-[420px] -translate-x-1/2 rounded-[24px] bg-white p-5 text-zinc-900 shadow-[0_22px_70px_rgba(28,25,23,0.20)]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <h3 className="text-xl font-semibold leading-7">图像设置</h3>
      <SettingSection title="质量">
        <div className="grid grid-cols-4 gap-3">
          {QUALITY_OPTIONS.map((option) => (
            <OptionButton key={option} selected={quality === option} onClick={() => onQualityChange(option)}>
              {qualityLabel(option)}
            </OptionButton>
          ))}
        </div>
      </SettingSection>
      <SettingSection title="尺寸">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SizeInput label="W" value={width} onChange={(next) => onSizeChange(next, height)} />
          <span className="text-zinc-400">↔</span>
          <SizeInput label="H" value={height} onChange={(next) => onSizeChange(width, next)} />
        </div>
      </SettingSection>
      <SettingSection title="宽高比">
        <div className="grid grid-cols-4 gap-3">
          {IMAGE_PRESETS.map((preset) => (
            <RatioButton
              key={preset.label}
              label={preset.label}
              selected={selectedPreset?.label === preset.label}
              onClick={() => onPresetChange(preset)}
            />
          ))}
        </div>
      </SettingSection>
      <SettingSection title="生成张数">
        <div className="grid grid-cols-4 gap-3">
          {COUNT_OPTIONS.map((option) => (
            <OptionButton key={option} selected={count === option} onClick={() => onCountChange(option)}>
              {option} 张
            </OptionButton>
          ))}
        </div>
      </SettingSection>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 text-sm font-medium text-zinc-500">{title}</div>
      {children}
    </section>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-11 items-center justify-center rounded-full border px-4 text-base transition ${
        selected
          ? 'border-zinc-900 bg-white text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RatioButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [w, h] = label.split('(')[0].split(':').map(Number);
  const isAuto = label === 'auto';
  const vertical = !isAuto && h > w;
  return (
    <button
      type="button"
      className={`flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[18px] border px-2 text-base transition ${
        selected
          ? 'border-zinc-900 bg-white text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400'
      }`}
      onClick={onClick}
    >
      {isAuto ? (
        <span className="flex h-8 items-center text-lg">auto</span>
      ) : (
        <span
          className={`block border-2 border-zinc-900 ${
            vertical ? 'h-8 w-4' : w === h ? 'h-7 w-7' : 'h-4 w-8'
          }`}
        />
      )}
      <span>{label}</span>
    </button>
  );
}

function SizeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
}) {
  return (
    <label className="flex h-11 items-center gap-3 rounded-[14px] bg-zinc-100 px-4 text-sm text-zinc-500">
      <span>{label}</span>
      <input
        className="min-w-0 flex-1 bg-transparent text-base text-zinc-900 outline-none"
        type="number"
        min={64}
        max={4096}
        step={8}
        value={value}
        onChange={(event) => onChange(toSizeDraft(event.target.value))}
      />
    </label>
  );
}

function parseSize(size: string | undefined): { width?: number; height?: number } {
  const match = size?.match(/^(\d+)x(\d+)$/);
  if (!match) return {};
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function toSizeDraft(value: string): number | '' {
  return value === '' ? '' : Number(value);
}

function clampDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(4096, Math.max(64, Math.round(value)));
}

function qualityLabel(value: string): string {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return '自动';
}

function findSelectedPreset(
  ratio: string | undefined,
  width: number | '',
  height: number | '',
): (typeof IMAGE_PRESETS)[number] | undefined {
  return IMAGE_PRESETS.find(
    (preset) =>
      preset.ratio === (ratio ?? '1:1') &&
      Number(width) === preset.width &&
      Number(height) === preset.height,
  );
}

function fitImageNodeSize(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const ratio = naturalWidth / naturalHeight;
  if (ratio >= 1) {
    const width = MAX_IMAGE_NODE_SIDE;
    const height = clampSide(width / ratio);
    return { width, height };
  }

  const height = MAX_IMAGE_NODE_SIDE;
  const width = clampSide(height * ratio);
  return { width, height };
}

function clampSide(value: number): number {
  return Math.round(Math.min(MAX_IMAGE_NODE_SIDE, Math.max(MIN_IMAGE_NODE_SIDE, value)));
}
