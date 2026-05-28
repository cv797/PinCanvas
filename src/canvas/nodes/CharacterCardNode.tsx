import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2, Play, User, Upload, Type } from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import { useGenerationTrigger } from '@/hooks/useGenerationTrigger';
import { useCanvas } from '@/store/canvas';
import { fileToDataURL } from '@/utils/image';
import type { CharacterCardNode as CharacterCardNodeT, ExpressionType, NodeId } from '@/types/node';

const EXPRESSION_OPTIONS: Array<{ value: ExpressionType; label: string }> = [
  { value: 'happy', label: '开心' },
  { value: 'sad', label: '悲伤' },
  { value: 'angry', label: '愤怒' },
  { value: 'surprised', label: '惊讶' },
  { value: 'neutral', label: '平静' },
  { value: 'excited', label: '兴奋' },
  { value: 'worried', label: '担心' },
  { value: 'shy', label: '害羞' },
];

export function CharacterCardNodeComp({ id, selected }: NodeProps) {
  const nid = id as NodeId;
  const IMAGE_MODELS = useModels('image');
  const node = useCanvas((s) => s.nodes.find((n) => n.id === nid) as CharacterCardNodeT | undefined);
  const patchSettings = useCanvas((s) => s.patchSettings);
  const trigger = useGenerationTrigger();

  if (!node || node.kind !== 'character-card') return null;
  const { settings } = node;
  const isBusy = settings.isGenerating;

  const toggleExpression = (expr: ExpressionType) => {
    const current = settings.expressions;
    const newExpressions = current.includes(expr)
      ? current.filter((e) => e !== expr)
      : [...current, expr];
    patchSettings<'character-card'>(nid, { expressions: newExpressions });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataURL = await fileToDataURL(file);
      patchSettings<'character-card'>(nid, { referenceImage: dataURL });
    } catch (err) {
      console.error('图片上传失败:', err);
    }
  };

  // 如果还没选择输入模式，显示选择界面
  if (!settings.inputMode) {
    return (
      <div
        className={`relative flex h-full w-full flex-col overflow-visible rounded-[22px] border bg-white/95 shadow-[0_18px_45px_rgba(24,24,27,0.10)] backdrop-blur transition-colors ${
          selected ? 'border-blue-500' : 'border-zinc-200'
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-3">
          <User className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-semibold leading-5 text-zinc-800">角色卡生成</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
          <p className="text-center text-sm text-zinc-600">选择输入方式</p>
          <button
            type="button"
            className="nodrag flex w-full items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 transition-all hover:border-purple-300 hover:bg-purple-50"
            onClick={() => patchSettings<'character-card'>(nid, { inputMode: 'text' })}
          >
            <Type className="h-5 w-5 text-purple-500" />
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-zinc-800">文字描述</div>
              <div className="text-xs text-zinc-500">用文字描述角色外貌</div>
            </div>
          </button>
          <button
            type="button"
            className="nodrag flex w-full items-center gap-3 rounded-lg border-2 border-zinc-200 bg-white px-4 py-3 transition-all hover:border-purple-300 hover:bg-purple-50"
            onClick={() => patchSettings<'character-card'>(nid, { inputMode: 'image' })}
          >
            <Upload className="h-5 w-5 text-purple-500" />
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-zinc-800">上传图片</div>
              <div className="text-xs text-zinc-500">上传参考图片生成</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-visible rounded-[22px] border bg-white/95 shadow-[0_18px_45px_rgba(24,24,27,0.10)] backdrop-blur transition-colors ${
        selected ? 'border-blue-500' : 'border-zinc-200'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-zinc-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-zinc-600 !bg-zinc-700"
      />

      <div className="flex shrink-0 items-center gap-2 px-3 pb-2.5 pt-3">
        <User className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-semibold leading-5 text-zinc-800">
          角色卡生成 ({settings.inputMode === 'text' ? '文字' : '图片'})
        </span>
        <button
          type="button"
          className="nodrag ml-auto text-xs text-zinc-400 hover:text-zinc-600"
          onClick={() => patchSettings<'character-card'>(nid, { inputMode: undefined })}
          disabled={isBusy}
        >
          切换
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        {/* 输入区域 */}
        {settings.inputMode === 'text' ? (
          <div className="shrink-0">
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">角色描述</label>
            <textarea
              className="nodrag w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50/30 px-3 py-2 text-sm leading-5 text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white"
              placeholder="描述角色的外貌、服装、特征..."
              value={settings.textDescription || ''}
              onChange={(e) => patchSettings<'character-card'>(nid, { textDescription: e.target.value })}
              disabled={isBusy}
              rows={3}
            />
          </div>
        ) : (
          <div className="shrink-0">
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">参考图片</label>
            {settings.referenceImage ? (
              <div className="relative">
                <img
                  src={settings.referenceImage}
                  alt="参考图"
                  className="h-32 w-full rounded-lg border border-zinc-200 object-cover"
                />
                <button
                  type="button"
                  className="nodrag absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
                  onClick={() => patchSettings<'character-card'>(nid, { referenceImage: undefined })}
                  disabled={isBusy}
                >
                  更换
                </button>
              </div>
            ) : (
              <label className="nodrag flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 transition-colors hover:border-purple-400 hover:bg-purple-50">
                <Upload className="h-6 w-6 text-zinc-400" />
                <span className="mt-2 text-xs text-zinc-500">点击上传图片</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isBusy}
                />
              </label>
            )}
          </div>
        )}

        {/* 视图类型 */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs font-medium text-zinc-600">视图类型</label>
          <div className="nodrag flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                settings.viewType === 'three'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
              onClick={() => patchSettings<'character-card'>(nid, { viewType: 'three' })}
              disabled={isBusy}
            >
              三视图
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                settings.viewType === 'four'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
              onClick={() => patchSettings<'character-card'>(nid, { viewType: 'four' })}
              disabled={isBusy}
            >
              四视图
            </button>
          </div>
        </div>

        {/* 表情选择 */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs font-medium text-zinc-600">
            表情选择 ({settings.expressions.length} 个)
          </label>
          <div className="nodrag grid grid-cols-4 gap-1.5">
            {EXPRESSION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  settings.expressions.includes(opt.value)
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                }`}
                onClick={() => toggleExpression(opt.value)}
                disabled={isBusy}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 布局模板 */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs font-medium text-zinc-600">布局模板</label>
          <div className="nodrag flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                settings.layout === 'classic'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
              onClick={() => patchSettings<'character-card'>(nid, { layout: 'classic' })}
              disabled={isBusy}
            >
              经典布局
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                settings.layout === 'compact'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
              onClick={() => patchSettings<'character-card'>(nid, { layout: 'compact' })}
              disabled={isBusy}
            >
              紧凑布局
            </button>
          </div>
        </div>

        {/* 模型选择 */}
        <div className="shrink-0">
          <label className="mb-1.5 block text-xs font-medium text-zinc-600">生成模型</label>
          <select
            className="nodrag w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-300 focus:border-blue-300"
            value={settings.model}
            onChange={(e) => patchSettings<'character-card'>(nid, { model: e.target.value })}
            disabled={isBusy}
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 高级选项 */}
        <details className="shrink-0">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600">高级选项</summary>
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">图片尺寸</label>
              <input
                type="number"
                className="nodrag w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-blue-300"
                value={settings.imageSize}
                onChange={(e) =>
                  patchSettings<'character-card'>(nid, { imageSize: Number(e.target.value) })
                }
                disabled={isBusy}
                min={768}
                max={1024}
                step={64}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">图片间距</label>
              <input
                type="number"
                className="nodrag w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 outline-none focus:border-blue-300"
                value={settings.spacing}
                onChange={(e) =>
                  patchSettings<'character-card'>(nid, { spacing: Number(e.target.value) })
                }
                disabled={isBusy}
                min={0}
                max={50}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`labels-${nid}`}
                className="nodrag"
                checked={settings.addLabels}
                onChange={(e) =>
                  patchSettings<'character-card'>(nid, { addLabels: e.target.checked })
                }
                disabled={isBusy}
              />
              <label htmlFor={`labels-${nid}`} className="text-xs text-zinc-600">
                添加文字标注
              </label>
            </div>
          </div>
        </details>

        {/* 状态提示 */}
        <div className="mt-auto shrink-0">
          {isBusy && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>生成中...{settings.progress ? `${settings.progress}%` : ''}</span>
            </div>
          )}
          {settings.error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {settings.error}
            </div>
          )}
          {settings.finalCardImage && !isBusy && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              角色卡生成完成
            </div>
          )}
        </div>

        {/* 生成按钮 */}
        <button
          type="button"
          className="nodrag mt-2 flex shrink-0 items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            isBusy ||
            (settings.inputMode === 'text' && !settings.textDescription) ||
            (settings.inputMode === 'image' && !settings.referenceImage)
          }
          onClick={() => {
            trigger(nid);
          }}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>生成角色卡</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
