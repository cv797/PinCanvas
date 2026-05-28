import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Video } from 'lucide-react';
import { useCanvas } from '@/store/canvas';
import type { NodeId, PreviewNode as PreviewNodeT } from '@/types/node';
import { frameClass, NODE_BODY, NODE_HEADER } from './shared';

export function PreviewNodeComp({ id, selected }: NodeProps) {
  const node = useCanvas(
    (s) => s.nodes.find((n) => n.id === (id as NodeId)) as PreviewNodeT | undefined,
  );
  if (!node || node.kind !== 'preview') return null;

  const url = node.settings.content;
  const isVideo = node.settings.previewType === 'video';

  return (
    <div className={frameClass(selected)}>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-4 !w-4 !border-2 !border-zinc-500 !bg-white"
      />
      <div className={`${NODE_HEADER} border-b-0 bg-transparent px-4 pt-4 [&>span:first-child]:hidden`}>
        <span>预览</span>
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
          <Video className="h-4 w-4 text-zinc-500" />
          预览
        </span>
      </div>
      <div className={`${NODE_BODY} m-3 mt-2 flex items-center justify-center overflow-hidden rounded-[18px] bg-zinc-100`}>
        {!url ? (
          <span className="text-xs text-zinc-400">未连接上游</span>
        ) : isVideo ? (
          <video src={url} controls className="h-full w-full bg-black object-contain" />
        ) : (
          <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
        )}
      </div>
    </div>
  );
}
