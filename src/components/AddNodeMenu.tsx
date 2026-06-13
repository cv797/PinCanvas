import {
  BookOpen,
  ClipboardList,
  Eye,
  Film,
  ImageIcon,
  Images,
  ImagePlus,
  Layers,
  MapPin,
  MonitorPlay,
  Mountain,
  Music,
  ShoppingBag,
  Type,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { createNode } from '@/canvas/factory';
import {
  FEATURE_DISABLED_MESSAGE,
  isNodeFeatureEnabled,
} from '@/config/features';
import { useCanvas } from '@/store/canvas';
import type { NodeId, NodeKind } from '@/types/node';
import { edgeId } from '@/utils/id';

interface MenuItem {
  kind?: NodeKind;
  template?: 'direct-final';
  label: string;
  Icon: typeof ImageIcon;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const GROUPS: MenuGroup[] = [
  {
    title: '电商成图',
    items: [
      { template: 'direct-final', label: '成图直出模板', Icon: ShoppingBag },
      { kind: 'direct-final-upload', label: '成图源图', Icon: ImageIcon },
      { kind: 'direct-final-analysis', label: '商业分析', Icon: ClipboardList },
      { kind: 'direct-final-gate', label: '门禁', Icon: BookOpen },
      { kind: 'direct-final-main-prompt', label: '主图脚本', Icon: ImagePlus },
      { kind: 'direct-final-detail-prompt', label: '详情脚本', Icon: Layers },
      { kind: 'direct-final-render', label: '成图执行', Icon: ImagePlus },
      { kind: 'direct-final-review', label: '成图复盘', Icon: Eye },
    ],
  },
  {
    title: '输入',
    items: [
      { kind: 'audio-input', label: '音频', Icon: Music },
      { kind: 'input-image', label: '图片', Icon: ImageIcon },
      { kind: 'text-node', label: '文本', Icon: Type },
      { kind: 'video-input', label: '视频', Icon: Video },
    ],
  },
  {
    title: '生成',
    items: [
      { kind: 'gen-image', label: '图片生成', Icon: ImagePlus },
      { kind: 'gen-video', label: '视频生成', Icon: Film },
      { kind: 'character-card', label: '角色卡', Icon: User },
      { kind: 'storyboard-node', label: '分镜', Icon: Layers },
    ],
  },
  {
    title: '理解',
    items: [
      { kind: 'video-analyze', label: '视频分析', Icon: Eye },
      { kind: 'extract-characters-scenes', label: '抽取角色 / 场景', Icon: BookOpen },
    ],
  },
  {
    title: '角色',
    items: [
      { kind: 'create-character', label: '创建角色', Icon: Users },
      { kind: 'generate-character-image', label: '角色形象', Icon: UserPlus },
      { kind: 'generate-character-video', label: '角色视频', Icon: Film },
    ],
  },
  {
    title: '场景',
    items: [
      { kind: 'create-scene', label: '创建场景', Icon: MapPin },
      { kind: 'generate-scene-image', label: '场景图', Icon: Mountain },
      { kind: 'generate-scene-video', label: '场景视频', Icon: Mountain },
    ],
  },
  {
    title: '输出',
    items: [
      { kind: 'preview', label: '预览', Icon: MonitorPlay },
      { kind: 'image-compare', label: '图片对比', Icon: Images },
    ],
  },
];

interface Props {
  onClose: () => void;
}

let createCount = 0;

export function AddNodeMenu({ onClose }: Props) {
  const addNode = useCanvas((s) => s.addNode);
  const addEdge = useCanvas((s) => s.addEdge);
  const setSelection = useCanvas((s) => s.setSelection);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const createDirectFinalTemplate = () => {
    if (!isNodeFeatureEnabled('direct-final-upload') || !isNodeFeatureEnabled('direct-final-analysis')) {
      window.alert(FEATURE_DISABLED_MESSAGE);
      return;
    }
    createCount += 1;
    const x = 140 + (createCount % 5) * 48;
    const y = 80 + (createCount % 5) * 32;
    const upload = createNode('direct-final-upload', { x, y });
    const analysis = createNode('direct-final-analysis', { x: x + 380, y });
    addNode(upload);
    addNode(analysis);
    addEdge({ id: edgeId(), from: upload.id, to: analysis.id });
    setSelection([upload.id, analysis.id] as NodeId[]);
    onClose();
  };

  const onPick = (item: MenuItem) => {
    if (item.template === 'direct-final') {
      createDirectFinalTemplate();
      return;
    }
    const kind = item.kind;
    if (!kind) return;
    if (!isNodeFeatureEnabled(kind)) {
      window.alert(FEATURE_DISABLED_MESSAGE);
      return;
    }
    createCount += 1;
    const x = 160 + (createCount % 8) * 40;
    const y = 80 + (createCount % 8) * 30;
    addNode(createNode(kind, { x, y }));
    onClose();
  };

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-white">
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-zinc-200 px-5">
          <div>
            <h2 className="text-[15px] font-semibold leading-5 text-zinc-900">节点库</h2>
            <p className="mt-1 text-xs font-medium leading-4 text-zinc-500">选择节点添加到画布</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {GROUPS.map((group) => (
            <section key={group.title} className="mb-5 last:mb-1">
              <h3 className="mb-2 text-xs font-semibold leading-4 text-zinc-500">
                {group.title}
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const { kind, template, label, Icon } = item;
                  const disabled = template === 'direct-final'
                    ? !isNodeFeatureEnabled('direct-final-upload') ||
                      !isNodeFeatureEnabled('direct-final-analysis')
                    : kind
                      ? !isNodeFeatureEnabled(kind)
                      : false;
                  return (
                  <li key={kind ?? template}>
                    <button
                      type="button"
                      className="flex h-20 w-full flex-col items-start justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400"
                      onClick={() => onPick(item)}
                      disabled={disabled}
                      title={disabled ? FEATURE_DISABLED_MESSAGE : label}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold leading-4">
                        {label}
                        {disabled ? '（即将上线）' : ''}
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
    </aside>
  );
}
