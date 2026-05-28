import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Upload } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useCanvas } from '@/store/canvas';
import type { InputImageNode as InputImageNodeT, NodeId } from '@/types/node';
import { fileToDataURL } from '@/utils/image';
import { NODE_BODY, NODE_HEADER } from './shared';

const MAX_IMAGE_NODE_SIDE = 360;
const MIN_IMAGE_NODE_SIDE = 140;

export function InputImageNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const node = useCanvas(
    (s) => s.nodes.find((n) => n.id === nid) as InputImageNodeT | undefined,
  );
  const patchSettings = useCanvas((s) => s.patchSettings);
  const resizeNode = useCanvas((s) => s.resizeNode);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizeToImage = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight) return;
      const { width, height } = fitImageNodeSize(naturalWidth, naturalHeight);
      if (node && Math.abs(node.width - width) < 1 && Math.abs(node.height - height) < 1) return;
      resizeNode(nid, width, height);
      patchSettings<'input-image'>(nid, { width: naturalWidth, height: naturalHeight });
    },
    [nid, node, patchSettings, resizeNode],
  );

  const setImage = useCallback(
    async (file: File) => {
      const dataUrl = await fileToDataURL(file);
      const size = await getImageSize(dataUrl);
      patchSettings<'input-image'>(nid, {
        content: dataUrl,
        filename: file.name,
        width: size.width,
        height: size.height,
      });
      const fitted = fitImageNodeSize(size.width, size.height);
      resizeNode(nid, fitted.width, fitted.height);
    },
    [nid, patchSettings, resizeNode],
  );

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void setImage(file);
      e.target.value = '';
    },
    [setImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) void setImage(file);
    },
    [setImage],
  );

  if (!node || node.kind !== 'input-image') return null;
  const { settings } = node;
  const hasImage = !!settings.content;

  return (
    <div
      className="relative h-full w-full overflow-visible"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <Handle type="source" position={Position.Right} />
      {hasImage ? (
        <div
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[22px] border bg-zinc-100 shadow-[0_18px_45px_rgba(24,24,27,0.10)] transition-colors ${
            selected ? 'border-blue-500' : 'border-zinc-200'
          }`}
        >
          <img
            src={settings.content}
            alt={settings.filename ?? ''}
            className="h-full w-full rounded-[20px] object-contain"
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget;
              resizeToImage(img.naturalWidth, img.naturalHeight);
            }}
          />
          {settings.maskContent && (
            <img
              src={settings.maskContent}
              alt="mask"
              className="pointer-events-none absolute inset-0 h-full w-full rounded-[20px] object-contain opacity-40 mix-blend-screen"
              draggable={false}
            />
          )}
        </div>
      ) : (
        <div
          className={`flex h-full w-full flex-col overflow-visible rounded-[22px] border bg-white/95 shadow-[0_18px_45px_rgba(24,24,27,0.10)] backdrop-blur transition-colors ${
            selected ? 'border-blue-500' : 'border-zinc-200'
          }`}
        >
          <div className={NODE_HEADER}>
            <span>图片输入</span>
            <span className="ml-auto truncate text-zinc-400">{settings.filename ?? ''}</span>
          </div>
          <div className={`${NODE_BODY} flex flex-col justify-center gap-2 px-2 py-2`}>
            <button
              type="button"
              className="nodrag flex h-full min-h-[86px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 py-4 text-xs text-zinc-500 hover:border-zinc-400"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              点击 / 拖入图片
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
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

function getImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
