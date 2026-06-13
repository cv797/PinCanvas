import {
  Background,
  Controls,
  MiniMap,
  NodeResizer,
  Handle,
  Position,
  ReactFlow,
  type EdgeChange,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnNodeDrag,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Copy, Info, MessageSquare, Play, Trash2, X } from 'lucide-react';
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createInputImageFromDataURL, createNode } from '@/canvas/factory';
import {
  FEATURE_DISABLED_MESSAGE,
  isNodeFeatureEnabled,
} from '@/config/features';
import { useCanvas, useTemporal } from '@/store/canvas';
import { getHistoryImageDragData, hasHistoryImageDragData } from '@/utils/drag';
import { fileToDataURL } from '@/utils/image';
import { edgeId } from '@/utils/id';
import { useGenerationTrigger } from '@/hooks/useGenerationTrigger';
import type { AppEdge } from '@/types/edge';
import type { AppNode, NodeId, NodeKind } from '@/types/node';
import { AudioInputNodeComp } from './nodes/AudioInputNode';
import { CreateCharacterNodeComp } from './nodes/CreateCharacterNode';
import { CreateSceneNodeComp } from './nodes/CreateSceneNode';
import { ExtractCharactersScenesNodeComp } from './nodes/ExtractCharactersScenesNode';
import { GenerateCharacterVideoNodeComp } from './nodes/GenerateCharacterVideoNode';
import { GenerateSceneVideoNodeComp } from './nodes/GenerateSceneVideoNode';
import { StoryboardNodeComp } from './nodes/StoryboardNode';
import { GenerateCharacterImageNodeComp } from './nodes/GenerateCharacterImageNode';
import { GenerateSceneImageNodeComp } from './nodes/GenerateSceneImageNode';
import { GenImageNodeComp } from './nodes/GenImageNode';
import { GenVideoNodeComp } from './nodes/GenVideoNode';
import { InputImageNodeComp } from './nodes/InputImageNode';
import { ImageCompareNodeComp } from './nodes/ImageCompareNode';
import { PendingNodePickerNodeComp } from './nodes/PendingNodePickerNode';
import { PreviewNodeComp } from './nodes/PreviewNode';
import { TextNodeComp } from './nodes/TextNode';
import { VideoAnalyzeNodeComp } from './nodes/VideoAnalyzeNode';
import { VideoInputNodeComp } from './nodes/VideoInputNode';
import { CharacterCardNodeComp } from './nodes/CharacterCardNode';
import { ScriptToStoryboardNodeComp } from './nodes/ScriptToStoryboardNode';
import { ChatNodeComp } from './nodes/ChatNode';
import { StoryboardViewerNodeComp } from './nodes/StoryboardViewerNode';
import {
  DirectFinalAnalysisNodeComp,
  DirectFinalDetailPromptNodeComp,
  DirectFinalGateNodeComp,
  DirectFinalMainPromptNodeComp,
  DirectFinalRenderNodeComp,
  DirectFinalReviewNodeComp,
  DirectFinalUploadNodeComp,
} from './nodes/DirectFinalNodes';

function withNodeChrome(Component: ComponentType<any>) {
  return function NodeChrome(props: any) {
    const id = props.id as NodeId;
    const selectedIds = useCanvas((s) => s.selectedIds);
    const node = useCanvas((s) => s.nodes.find((item) => item.id === id));
    const setSelection = useCanvas((s) => s.setSelection);
    const removeNode = useCanvas((s) => s.removeNode);
    const trigger = useGenerationTrigger();
    const isSelected = props.selected || selectedIds.includes(id);
    const kind = node?.kind ?? (props.type as NodeKind | undefined);
    const featureDisabled = kind ? !isNodeFeatureEnabled(kind) : false;
    const [infoOpen, setInfoOpen] = useState(false);

    return (
      <div
        className="relative h-full w-full"
        onPointerDownCapture={(event) => {
          if (shouldSelectNodeFromPointerDown(event)) setSelection([id]);
        }}
      >
        {kind && nodeHasTargetHandle(kind) && (
          <Handle
            type="target"
            position={Position.Left}
            className="canvas-node-top-handle"
          />
        )}
        {kind && nodeHasSourceHandle(kind) && (
          <Handle
            type="source"
            position={Position.Right}
            className="canvas-node-top-handle"
          />
        )}
        <NodeResizer
          isVisible={isSelected}
          minWidth={160}
          minHeight={120}
          lineClassName="!border-blue-500"
          handleClassName="!h-3 !w-3 !rounded-full !border-2 !border-blue-500 !bg-white !shadow-sm"
        />
        <div
          className={`pointer-events-none absolute inset-0 z-[1] rounded-[24px] transition-all ${
            isSelected
              ? 'border-2 border-blue-500 shadow-[0_0_0_1px_rgba(47,128,255,0.22),0_18px_45px_rgba(37,99,235,0.16)]'
              : 'border border-transparent'
          }`}
        />
        {isSelected && (
          <NodeHoverToolbar
            node={node}
            onInfo={() => setInfoOpen((open) => !open)}
            onEdit={() => setSelection([id])}
            onGenerate={() => {
              if (node && canTriggerNode(node.kind)) trigger(id);
            }}
            onDelete={() => removeNode(id)}
          />
        )}
        {isSelected && infoOpen && node && (
          <NodeInfoPopover node={node} onClose={() => setInfoOpen(false)} />
        )}
        <button
          type="button"
          className={`nodrag absolute -right-3 -top-3 z-20 hidden h-7 w-7 items-center justify-center rounded-full border bg-white shadow-md transition-all hover:scale-105 hover:text-zinc-700 ${
            isSelected
              ? 'border-blue-200 text-zinc-500 opacity-100'
              : 'pointer-events-none border-zinc-200 text-zinc-400 opacity-0'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
          aria-label="删除节点"
          title="删除节点"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <Component {...props} selected={isSelected} />
        {featureDisabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/85 px-4 text-center text-sm font-semibold text-zinc-700 backdrop-blur-[1px]">
            {FEATURE_DISABLED_MESSAGE}
          </div>
        )}
      </div>
    );
  };
}

function NodeHoverToolbar({
  node,
  onInfo,
  onEdit,
  onGenerate,
  onDelete,
}: {
  node: AppNode | undefined;
  onInfo: () => void;
  onEdit: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const canGenerate = node ? canTriggerNode(node.kind) : false;
  return (
    <div
      className="nodrag absolute left-1/2 top-0 z-30 flex h-12 -translate-x-1/2 -translate-y-[calc(100%+14px)] items-center overflow-hidden rounded-[18px] border border-black/10 bg-white text-[15px] text-zinc-900 shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <ToolbarButton title="节点信息" label="信息" onClick={onInfo} icon={<Info className="h-4 w-4" />} />
      <ToolbarButton
        title="删除节点"
        label="删除"
        onClick={onDelete}
        icon={<Trash2 className="h-4 w-4" />}
        danger
      />
      <span className="mx-1 h-7 w-px bg-zinc-200" />
      <ToolbarButton title="编辑节点" label="编辑" onClick={onEdit} icon={<MessageSquare className="h-4 w-4" />} />
      {canGenerate && (
        <ToolbarButton title="生成" label="生成" onClick={onGenerate} icon={<Play className="h-4 w-4" />} />
      )}
    </div>
  );
}

function ToolbarButton({
  title,
  label,
  icon,
  onClick,
  danger = false,
}: {
  title: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex h-12 items-center px-1.5 ${danger ? 'text-red-600' : 'text-zinc-900'}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <span className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 transition hover:bg-zinc-100">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );
}

function NodeInfoPopover({ node, onClose }: { node: AppNode; onClose: () => void }) {
  const copyId = useCallback(() => {
    if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(node.id);
  }, [node.id]);

  return (
    <div
      className="nodrag absolute left-1/2 top-14 z-40 w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-xl shadow-zinc-300/40"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-zinc-900">Node info</div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        <InfoRow label="Type" value={node.kind} />
        <div>
          <div className="mb-1 text-[11px] font-medium text-zinc-400">ID</div>
          <div className="flex items-center gap-1.5">
            <input
              className="h-8 min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2 font-mono text-[11px] text-zinc-700"
              value={node.id}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={copyId}
              aria-label="Copy ID"
              title="Copy ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <InfoRow label="Size" value={`${Math.round(node.width)} x ${Math.round(node.height)}`} />
        <InfoRow label="Position" value={`${Math.round(node.x)}, ${Math.round(node.y)}`} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      <span className="truncate font-medium text-zinc-800">{value}</span>
    </div>
  );
}

function canTriggerNode(kind: NodeKind): boolean {
  return (
    kind === 'gen-image' ||
    kind === 'gen-video' ||
    kind === 'generate-character-image' ||
    kind === 'generate-scene-image' ||
    kind === 'generate-character-video' ||
    kind === 'generate-scene-video' ||
    kind === 'extract-characters-scenes' ||
    kind === 'character-card' ||
    kind === 'direct-final-analysis' ||
    kind === 'direct-final-main-prompt' ||
    kind === 'direct-final-detail-prompt' ||
    kind === 'direct-final-render' ||
    kind === 'direct-final-review'
  );
}

function nodeHasTargetHandle(kind: NodeKind): boolean {
  return (
    kind === 'gen-image' ||
    kind === 'gen-video' ||
    kind === 'preview' ||
    kind === 'image-compare' ||
    kind === 'video-analyze' ||
    kind === 'pending-node-picker' ||
    kind === 'generate-character-image' ||
    kind === 'generate-scene-image' ||
    kind === 'generate-character-video' ||
    kind === 'generate-scene-video' ||
    kind === 'extract-characters-scenes' ||
    kind === 'storyboard-node' ||
    kind === 'script-to-storyboard' ||
    kind === 'storyboard-viewer' ||
    kind === 'chat' ||
    kind === 'character-card' ||
    kind === 'direct-final-analysis' ||
    kind === 'direct-final-gate' ||
    kind === 'direct-final-main-prompt' ||
    kind === 'direct-final-detail-prompt' ||
    kind === 'direct-final-render' ||
    kind === 'direct-final-review'
  );
}

function nodeHasSourceHandle(kind: NodeKind): boolean {
  return (
    kind === 'input-image' ||
    kind === 'audio-input' ||
    kind === 'text-node' ||
    kind === 'gen-image' ||
    kind === 'gen-video' ||
    kind === 'video-input' ||
    kind === 'image-compare' ||
    kind === 'video-analyze' ||
    kind === 'create-character' ||
    kind === 'create-scene' ||
    kind === 'generate-character-image' ||
    kind === 'generate-scene-image' ||
    kind === 'generate-character-video' ||
    kind === 'generate-scene-video' ||
    kind === 'extract-characters-scenes' ||
    kind === 'storyboard-node' ||
    kind === 'script-to-storyboard' ||
    kind === 'storyboard-viewer' ||
    kind === 'chat' ||
    kind === 'character-card' ||
    kind === 'direct-final-upload' ||
    kind === 'direct-final-analysis' ||
    kind === 'direct-final-gate' ||
    kind === 'direct-final-main-prompt' ||
    kind === 'direct-final-detail-prompt' ||
    kind === 'direct-final-render' ||
    kind === 'direct-final-review'
  );
}

function shouldSelectNodeFromPointerDown(event: React.PointerEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  return !target.closest('.react-flow__handle, .react-flow__resize-control');
}

const nodeTypes: NodeTypes = {
  'input-image': withNodeChrome(InputImageNodeComp),
  'audio-input': withNodeChrome(AudioInputNodeComp),
  preview: withNodeChrome(PreviewNodeComp),
  'image-compare': withNodeChrome(ImageCompareNodeComp),
  'text-node': withNodeChrome(TextNodeComp),
  'gen-image': withNodeChrome(GenImageNodeComp),
  'video-input': withNodeChrome(VideoInputNodeComp),
  'gen-video': withNodeChrome(GenVideoNodeComp),
  'video-analyze': withNodeChrome(VideoAnalyzeNodeComp),
  'pending-node-picker': withNodeChrome(PendingNodePickerNodeComp),
  'create-character': withNodeChrome(CreateCharacterNodeComp),
  'create-scene': withNodeChrome(CreateSceneNodeComp),
  'generate-character-image': withNodeChrome(GenerateCharacterImageNodeComp),
  'generate-scene-image': withNodeChrome(GenerateSceneImageNodeComp),
  'extract-characters-scenes': withNodeChrome(ExtractCharactersScenesNodeComp),
  'storyboard-node': withNodeChrome(StoryboardNodeComp),
  'script-to-storyboard': withNodeChrome(ScriptToStoryboardNodeComp),
  'storyboard-viewer': withNodeChrome(StoryboardViewerNodeComp),
  chat: withNodeChrome(ChatNodeComp),
  'generate-character-video': withNodeChrome(GenerateCharacterVideoNodeComp),
  'generate-scene-video': withNodeChrome(GenerateSceneVideoNodeComp),
  'character-card': withNodeChrome(CharacterCardNodeComp),
  'direct-final-upload': withNodeChrome(DirectFinalUploadNodeComp),
  'direct-final-analysis': withNodeChrome(DirectFinalAnalysisNodeComp),
  'direct-final-gate': withNodeChrome(DirectFinalGateNodeComp),
  'direct-final-main-prompt': withNodeChrome(DirectFinalMainPromptNodeComp),
  'direct-final-detail-prompt': withNodeChrome(DirectFinalDetailPromptNodeComp),
  'direct-final-render': withNodeChrome(DirectFinalRenderNodeComp),
  'direct-final-review': withNodeChrome(DirectFinalReviewNodeComp),
};

const QUICK_ADD: Array<{ kind: NodeKind; label: string; hint: string }> = [
  { kind: 'audio-input', label: '音频输入', hint: '上传或预览音频素材' },
  { kind: 'text-node', label: '文本', hint: '提示词 / 小说片段' },
  { kind: 'chat', label: '对话', hint: '简单的 LLM 对话测试' },
  { kind: 'input-image', label: '图片输入', hint: '粘贴或导入参考图' },
  { kind: 'gen-image', label: '图片生成', hint: '文生图 / 图生图' },
  { kind: 'character-card', label: '角色卡', hint: '生成角色三视图+表情包' },
  { kind: 'script-to-storyboard', label: '剧本转分镜', hint: 'AI 生成分镜脚本+首尾帧' },
  { kind: 'storyboard-viewer', label: '分镜展示', hint: '查看分镜首尾帧' },
  { kind: 'gen-video', label: '视频生成', hint: '根据提示生成视频' },
  { kind: 'video-analyze', label: '视频分析', hint: '提取关键帧描述' },
  { kind: 'extract-characters-scenes', label: '抽取角色 / 场景', hint: '从文本生成资产' },
  { kind: 'preview', label: '预览', hint: '查看图像或视频' },
  { kind: 'image-compare', label: '图片对比', hint: '并排查看多张生成结果' },
  { kind: 'direct-final-upload', label: '成图源图', hint: '电商成图直出源图' },
  { kind: 'direct-final-analysis', label: '商业分析', hint: '生成商业输入草稿' },
  { kind: 'direct-final-gate', label: '门禁', hint: '必卖理由卡' },
  { kind: 'direct-final-main-prompt', label: '主图脚本', hint: '生成主图成图脚本' },
  { kind: 'direct-final-detail-prompt', label: '详情脚本', hint: '生成详情模块脚本' },
  { kind: 'direct-final-render', label: '成图执行', hint: '结构化脚本生成图片' },
  { kind: 'direct-final-review', label: '成图复盘', hint: '复盘输出图片' },
];

const REFERENCE_DROP_TARGETS: ReadonlySet<NodeKind> = new Set(['gen-image', 'direct-final-render']);
const PENDING_NODE_PICKER_HEIGHT = 180;
const REFERENCE_PICKER_HEIGHT = 300;

type ContextMenuState =
  | { type: 'pane'; x: number; y: number; flowX: number; flowY: number }
  | { type: 'node'; x: number; y: number; nodeId: NodeId }
  | { type: 'edge'; x: number; y: number; edgeId: string }
  | null;

function toFlowNode(n: AppNode, connectHoverTargetId: NodeId | null): RFNode {
  const selected = useCanvas.getState().selectedIds.includes(n.id);
  return {
    id: n.id,
    type: n.kind,
    position: { x: n.x, y: n.y },
    data: {},
    width: n.width,
    height: n.height,
    selected,
    className: n.id === connectHoverTargetId ? 'canvas-node-connect-hover' : undefined,
  };
}

function toFlowEdge(e: AppEdge, selectedEdgeId: string | null): RFEdge {
  const selected = e.id === selectedEdgeId;
  return {
    id: e.id,
    source: e.from,
    target: e.to,
    selected,
    className: selected ? 'canvas-edge canvas-edge-selected' : 'canvas-edge',
  };
}

function firstImageFile(dataTransfer: DataTransfer): File | null {
  for (const file of Array.from(dataTransfer.files)) {
    if (file.type.startsWith('image/')) return file;
  }
  return null;
}

function hasImageItem(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some((item) => item.type.startsWith('image/'));
}

function findDropTarget(nodes: AppNode[], x: number, y: number): AppNode | null {
  for (const node of [...nodes].reverse()) {
    if (!REFERENCE_DROP_TARGETS.has(node.kind)) continue;
    if (x < node.x || y < node.y) continue;
    if (x > node.x + node.width || y > node.y + node.height) continue;
    return node;
  }
  return null;
}

function findConnectTarget(nodes: AppNode[], x: number, y: number, sourceId: NodeId): AppNode | null {
  const source = nodes.find((node) => node.id === sourceId);
  if (!source) return null;
  for (const node of [...nodes].reverse()) {
    if (node.id === sourceId) continue;
    if (x < node.x || y < node.y) continue;
    if (x > node.x + node.width || y > node.y + node.height) continue;
    if (!canConnectNodes(source, node)) continue;
    return node;
  }
  return null;
}

function canConnectNodes(source: AppNode, target: AppNode): boolean {
  if (source.id === target.id) return false;
  if (target.kind === 'gen-image') return isImageSourceNode(source);
  if (target.kind === 'direct-final-render') {
    return isImageSourceNode(source) || isDirectFinalPromptNode(source);
  }
  return true;
}

function isImageSourceNode(node: AppNode): boolean {
  if (node.kind === 'input-image') return !!node.settings.content;
  if (node.kind === 'direct-final-upload') return !!node.settings.content;
  if (node.kind === 'gen-image') return !!node.content;
  if (node.kind === 'direct-final-render') return !!node.content;
  if (node.kind === 'image-compare') return node.settings.images.length > 0;
  if (node.kind === 'preview') return node.settings.previewType !== 'video' && !!(node.settings.content || node.content);
  return false;
}

function isDirectFinalPromptNode(node: AppNode): boolean {
  return node.kind === 'direct-final-main-prompt' || node.kind === 'direct-final-detail-prompt';
}

export function Canvas() {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const addNode = useCanvas((s) => s.addNode);
  const moveNode = useCanvas((s) => s.moveNode);
  const removeNode = useCanvas((s) => s.removeNode);
  const removeEdge = useCanvas((s) => s.removeEdge);
  const addEdge = useCanvas((s) => s.addEdge);
  const setSelection = useCanvas((s) => s.setSelection);
  const selectedIds = useCanvas((s) => s.selectedIds);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [menu, setMenu] = useState<ContextMenuState>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectHoverTargetId, setConnectHoverTargetId] = useState<NodeId | null>(null);
  const connectionSourceIdRef = useRef<NodeId | null>(null);
  const suppressNextCanvasClickRef = useRef(false);

  const flowNodes = useMemo(
    () => nodes.map((node) => toFlowNode(node, connectHoverTargetId)),
    [nodes, selectedIds, connectHoverTargetId],
  );
  const flowEdges = useMemo(
    () => edges.map((edge) => toFlowEdge(edge, selectedEdgeId)),
    [edges, selectedEdgeId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          moveNode(ch.id as NodeId, ch.position.x, ch.position.y);
        } else if (ch.type === 'dimensions' && ch.dimensions) {
          useCanvas
            .getState()
            .resizeNode(ch.id as NodeId, ch.dimensions.width, ch.dimensions.height);
        } else if (ch.type === 'remove') {
          removeNode(ch.id as NodeId);
        } else if (ch.type === 'select') {
          const cur = useCanvas.getState().selectedIds;
          const next = ch.selected
            ? cur.includes(ch.id as NodeId)
              ? cur
              : [...cur, ch.id as NodeId]
            : cur.filter((sid) => sid !== ch.id);
          setSelection(next);
        }
      }
    },
    [moveNode, removeNode, setSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const ch of changes) {
        if (ch.type === 'remove') {
          removeEdge(ch.id);
          if (selectedEdgeId === ch.id) setSelectedEdgeId(null);
        } else if (ch.type === 'select') {
          setSelectedEdgeId(ch.selected ? ch.id : null);
          if (ch.selected) setSelection([]);
        }
      }
    },
    [removeEdge, selectedEdgeId, setSelection],
  );

  const onConnect: OnConnect = useCallback(
    (c) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const state = useCanvas.getState();
      const source = state.nodes.find((node) => node.id === c.source);
      const target = state.nodes.find((node) => node.id === c.target);
      if (!source || !target || !canConnectNodes(source, target)) return;
      addEdge({ id: edgeId(), from: c.source as NodeId, to: c.target as NodeId });
      setSelectedEdgeId(null);
      setConnectHoverTargetId(null);
    },
    [addEdge],
  );

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    connectionSourceIdRef.current = params.nodeId ? (params.nodeId as NodeId) : null;
    setConnectHoverTargetId(null);
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!flow) return;
      const sourceId =
        (connectionState.fromNode?.id as NodeId | undefined) ?? connectionSourceIdRef.current;
      connectionSourceIdRef.current = null;
      setConnectHoverTargetId(null);
      if (!sourceId || connectionState.toNode) return;
      const point = getClientPoint(event);
      if (!point) return;
      const pos = flow.screenToFlowPosition(point);
      const targetNode = findConnectTarget(useCanvas.getState().nodes, pos.x, pos.y, sourceId);
      if (targetNode) {
        suppressNextCanvasClickRef.current = true;
        addEdge({ id: edgeId(), from: sourceId, to: targetNode.id });
        setSelection([sourceId, targetNode.id]);
        return;
      }
      suppressNextCanvasClickRef.current = true;
      const sourceNode = useCanvas.getState().nodes.find((n) => n.id === sourceId);
      const height =
        sourceNode?.kind === 'image-compare' ? REFERENCE_PICKER_HEIGHT : PENDING_NODE_PICKER_HEIGHT;
      const node = createNode('pending-node-picker', {
        x: pos.x,
        y: pos.y - height / 2,
      });
      node.height = height;
      addNode(node);
      addEdge({ id: edgeId(), from: sourceId, to: node.id });
      setSelection([sourceId, node.id]);
    },
    [addEdge, addNode, flow, setSelection],
  );

  useEffect(() => {
    if (!flow) return undefined;
    const onPointerMove = (event: PointerEvent) => {
      const sourceId = connectionSourceIdRef.current;
      if (!sourceId) return;
      const pos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const target = findConnectTarget(useCanvas.getState().nodes, pos.x, pos.y, sourceId);
      setConnectHoverTargetId((current) => (current === target?.id ? current : (target?.id ?? null)));
    };
    const clearConnectionHover = () => setConnectHoverTargetId(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', clearConnectionHover);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', clearConnectionHover);
    };
  }, [flow]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const handle = (event.target as Element | null)?.closest?.('.react-flow__handle');
      if (!(handle instanceof HTMLElement)) return;
      const rect = handle.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width / 2 - 8;
      const distance = Math.hypot(dx, dy);
      const scale = distance > max && distance > 0 ? max / distance : 1;
      handle.style.setProperty('--handle-x', `${dx * scale}px`);
      handle.style.setProperty('--handle-y', `${dy * scale}px`);
      handle.classList.add('canvas-handle-active');
    };
    const resetHandle = (event: PointerEvent) => {
      const handle = event.currentTarget;
      if (!(handle instanceof HTMLElement)) return;
      handle.style.setProperty('--handle-x', '0px');
      handle.style.setProperty('--handle-y', '0px');
      handle.classList.remove('canvas-handle-active');
    };
    const bindHandle = (handle: Element) => {
      handle.addEventListener('pointermove', onPointerMove as EventListener);
      handle.addEventListener('pointerleave', resetHandle as EventListener);
      handle.addEventListener('pointercancel', resetHandle as EventListener);
    };
    const unbindHandle = (handle: Element) => {
      handle.removeEventListener('pointermove', onPointerMove as EventListener);
      handle.removeEventListener('pointerleave', resetHandle as EventListener);
      handle.removeEventListener('pointercancel', resetHandle as EventListener);
    };

    const bindAll = () => document.querySelectorAll('.react-flow__handle').forEach(bindHandle);
    bindAll();
    const observer = new MutationObserver(bindAll);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll('.react-flow__handle').forEach(unbindHandle);
    };
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasImageItem(e.dataTransfer) && !hasHistoryImageDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const file = firstImageFile(e.dataTransfer);
      const historyImage = getHistoryImageDragData(e.dataTransfer);
      if ((!file && !historyImage) || !flow) return;

      e.preventDefault();
      e.stopPropagation();

      const dropPos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const target = findDropTarget(useCanvas.getState().nodes, dropPos.x, dropPos.y);

      const readImage = file
        ? fileToDataURL(file).then((url) => ({
            url,
            filename: file.name,
          }))
        : Promise.resolve({
            url: historyImage?.url ?? '',
            filename: historyImage?.filename ?? 'history-image.png',
          });

      void readImage.then(({ url, filename }) => {
        const state = useCanvas.getState();
        const currentTarget = target
          ? state.nodes.find((node) => node.id === target.id)
          : undefined;
        const targetNode =
          currentTarget && REFERENCE_DROP_TARGETS.has(currentTarget.kind) ? currentTarget : null;
        const inputPos = targetNode
          ? {
              x: targetNode.x - 340,
              y: targetNode.y,
            }
          : dropPos;
        const inputNode = createInputImageFromDataURL(url, filename, inputPos);

        state.addNode(inputNode);
        if (targetNode) {
          state.addEdge({ id: edgeId(), from: inputNode.id, to: targetNode.id });
          state.setSelection([inputNode.id, targetNode.id]);
        } else {
          state.setSelection([inputNode.id]);
        }
      });
    },
    [flow],
  );

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    useTemporal.getState().pause();
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_e, node) => {
      const t = useTemporal.getState();
      t.resume();
      moveNode(node.id as NodeId, node.position.x, node.position.y);
    },
    [moveNode],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  const onPaneContextMenu = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      e.preventDefault();
      if (!flow) return;
      const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setMenu({
        type: 'pane',
        x: e.clientX,
        y: e.clientY,
        flowX: pos.x,
        flowY: pos.y,
      });
    },
    [flow],
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode) => {
      e.preventDefault();
      setSelectedEdgeId(null);
      setSelection([node.id as NodeId]);
      setMenu({
        type: 'node',
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id as NodeId,
      });
    },
    [setSelection],
  );

  const onEdgeClick = useCallback(
    (e: React.MouseEvent, edge: RFEdge) => {
      e.stopPropagation();
      setSelectedEdgeId(edge.id);
      setSelection([]);
      closeMenu();
    },
    [closeMenu, setSelection],
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: RFEdge) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedEdgeId(edge.id);
      setSelection([]);
      setMenu({
        type: 'edge',
        x: e.clientX,
        y: e.clientY,
        edgeId: edge.id,
      });
    },
    [setSelection],
  );

  const clearSelection = useCallback(() => {
    setSelectedEdgeId(null);
    setSelection([]);
    closeMenu();
  }, [closeMenu, setSelection]);

  const onCanvasClick = useCallback(() => {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      return;
    }
    closeMenu();
  }, [closeMenu]);

  const onPaneClick = useCallback(() => {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      return;
    }
    clearSelection();
  }, [clearSelection]);

  const addQuickNode = useCallback(
    (kind: NodeKind) => {
      if (!menu || menu.type !== 'pane') return;
      if (!isNodeFeatureEnabled(kind)) {
        window.alert(FEATURE_DISABLED_MESSAGE);
        return;
      }
      addNode(createNode(kind, { x: menu.flowX, y: menu.flowY }));
      closeMenu();
    },
    [addNode, closeMenu, menu],
  );

  const deleteNode = useCallback(
    (id: NodeId) => {
      removeNode(id);
      setSelectedEdgeId(null);
      closeMenu();
    },
    [closeMenu, removeNode],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      removeEdge(id);
      setSelectedEdgeId(null);
      closeMenu();
    },
    [closeMenu, removeEdge],
  );

  useEffect(() => {
    if (selectedEdgeId && !edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [edges, selectedEdgeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const state = useCanvas.getState();
      if (!selectedEdgeId && state.selectedIds.length === 0) return;
      e.preventDefault();
      if (selectedEdgeId) {
        state.removeEdge(selectedEdgeId);
        setSelectedEdgeId(null);
        return;
      }
      for (const id of state.selectedIds) {
        state.removeNode(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMenu, selectedEdgeId]);

  return (
    <div className="h-full w-full" onClick={onCanvasClick}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onInit={setFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onDragOverCapture={onDragOver}
        onDropCapture={onDrop}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        onMoveStart={closeMenu}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={48} size={1} color="#d9d6cf" />
        <Controls position="bottom-right" />
        <MiniMap pannable zoomable position="top-right" />
      </ReactFlow>
      {menu?.type === 'pane' && (
        <ContextMenu x={menu.x} y={menu.y}>
          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-zinc-400">快速添加</div>
          {QUICK_ADD.map((item) => {
            const disabled = !isNodeFeatureEnabled(item.kind);
            return (
            <button
              key={item.kind}
              type="button"
              className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-50"
              disabled={disabled}
              title={disabled ? FEATURE_DISABLED_MESSAGE : item.label}
              onClick={(e) => {
                e.stopPropagation();
                addQuickNode(item.kind);
              }}
            >
              <span className="text-[13px] font-medium leading-5 text-zinc-800">
                {item.label}
                {disabled ? '（即将上线）' : ''}
              </span>
              <span className="text-[11px] leading-4 text-zinc-400">
                {disabled ? FEATURE_DISABLED_MESSAGE : item.hint}
              </span>
            </button>
            );
          })}
        </ContextMenu>
      )}
      {menu?.type === 'node' && (
        <ContextMenu x={menu.x} y={menu.y}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-8 rounded-md px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(menu.nodeId);
            }}
          >
            删除节点
            <span className="text-[11px] font-normal text-red-300">Delete</span>
          </button>
        </ContextMenu>
      )}
      {menu?.type === 'edge' && (
        <ContextMenu x={menu.x} y={menu.y}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-8 rounded-md px-3 py-2 text-left text-[13px] font-medium text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              deleteEdge(menu.edgeId);
            }}
          >
            删除连线
            <span className="text-[11px] font-normal text-red-300">Delete</span>
          </button>
        </ContextMenu>
      )}
    </div>
  );
}

function getClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

function ContextMenu({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="fixed z-50 min-w-[190px] rounded-lg border border-zinc-200 bg-white p-1 shadow-xl shadow-zinc-300/40"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
