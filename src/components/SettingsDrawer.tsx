import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { getModelDisplayName } from '@/api/models';
import { DEFAULT_IMAGE_MODEL, FIXED_BASE_URL } from '@/api/upstream';
import { useModels } from '@/hooks/useModels';
import { getPref, setPref } from '@/store/prefs';
import { ModelManager } from './ModelManager';
import { ProviderManager } from './ProviderManager';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TabType = 'settings' | 'models';

export function SettingsDrawer({ open, onClose }: Props) {
  const IMAGE_MODELS = useModels('image');
  const VIDEO_MODELS = useModels('video');
  const CHAT_MODELS = useModels('chat');
  const [draft, setDraft] = useState(loadSettingsDraft);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  useEffect(() => {
    if (!open) return;
    setDraft(loadSettingsDraft());
    setSaved(false);
    setActiveTab('settings');
  }, [open]);

  useEffect(() => {
    if (!open || VIDEO_MODELS.length === 0) return;
    setDraft((current) => {
      if (VIDEO_MODELS.some((m) => m.id === current.lastVideoModel)) return current;
      const fallback = VIDEO_MODELS.find((m) => m.id === DEFAULT_VIDEO_MODEL) ?? VIDEO_MODELS[0];
      return { ...current, lastVideoModel: fallback.id };
    });
  }, [VIDEO_MODELS, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const patchDraft = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const saveSettings = () => {
    setPref('global_base_url', FIXED_BASE_URL);
    setPref('global_key', draft.apiKey.trim());
    setPref('last_image_model', draft.lastImageModel);
    setPref('last_video_model', draft.lastVideoModel);
    setPref('chat_model', draft.chatModel);
    setPref('batch_queue_mode', draft.queueMode);
    setPref('batch_concurrency', Math.max(1, Math.min(20, Number(draft.concurrency) || 1)));
    setPref('jimeng_use_local_file', draft.useJimengLocal);
    setPref('global_performance_mode', draft.perfMode);
    setSaved(true);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-40 flex h-screen w-[360px] flex-col overflow-y-auto bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-800">设置</h2>
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-zinc-200 bg-white px-4">
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'settings'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-600 hover:text-zinc-800'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            基础设置
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'models'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-zinc-600 hover:text-zinc-800'
            }`}
            onClick={() => setActiveTab('models')}
          >
            模型管理
          </button>
        </div>

        {activeTab === 'settings' ? (
          <div className="flex flex-col gap-3 p-4 text-sm">
          <Section title="服务商配置">
            <ProviderManager />
          </Section>

          <Section title="默认模型">
            <Field label="图片模型">
              <select
                className={inputCls}
                value={draft.lastImageModel}
                onChange={(e) => patchDraft('lastImageModel', e.target.value)}
              >
                {IMAGE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="视频模型">
              <select
                className={inputCls}
                value={draft.lastVideoModel}
                onChange={(e) => patchDraft('lastVideoModel', e.target.value)}
              >
                {VIDEO_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getModelDisplayName(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chat 模型">
              <select
                className={inputCls}
                value={draft.chatModel}
                onChange={(e) => patchDraft('chatModel', e.target.value)}
              >
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="任务队列">
            <Field label="模式">
              <div className="flex gap-1.5">
                <Radio
                  current={draft.queueMode}
                  value="parallel"
                  onSelect={(value) => patchDraft('queueMode', value)}
                >
                  并行
                </Radio>
                <Radio
                  current={draft.queueMode}
                  value="serial"
                  onSelect={(value) => patchDraft('queueMode', value)}
                >
                  串行
                </Radio>
              </div>
            </Field>
            <Field label="并发数">
              <input
                type="number"
                min={1}
                max={20}
                className={`${inputCls} w-24`}
                value={draft.concurrency}
                onChange={(e) =>
                  patchDraft(
                    'concurrency',
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </Field>
          </Section>

          <Section title="高级">
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={draft.useJimengLocal}
                onChange={(e) => patchDraft('useJimengLocal', e.target.checked)}
              />
              Jimeng 强制本地文件上传（远端 URL → fetch 转 Blob）
            </label>
            <Field label="性能模式">
              <div className="flex gap-1.5">
                <Radio
                  current={draft.perfMode}
                  value="normal"
                  onSelect={(value) => patchDraft('perfMode', value)}
                >
                  标准
                </Radio>
                <Radio
                  current={draft.perfMode}
                  value="ultra"
                  onSelect={(value) => patchDraft('perfMode', value)}
                >
                  极速
                </Radio>
              </div>
            </Field>
          </Section>

          <div className="sticky bottom-0 -mx-4 mt-1 flex items-center gap-2 border-t border-zinc-200 bg-white px-4 py-3">
            <button
              type="button"
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={saveSettings}
            >
              保存设置
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={onClose}
            >
              取消
            </button>
          </div>
          {saved && (
            <p className="px-1 text-[11px] text-green-600">
              设置已保存到 localStorage（<code>tapnow_*</code>）。
            </p>
          )}
        </div>
        ) : (
          <div className="flex flex-col gap-3 p-4 text-sm">
            <ModelManager />
          </div>
        )}
      </aside>
    </>
  );
}

const inputCls =
  'w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-blue-400';

const DEFAULT_VIDEO_MODEL = 'wan2.6-r2v-flash';

interface SettingsDraft {
  apiKey: string;
  lastImageModel: string;
  lastVideoModel: string;
  chatModel: string;
  queueMode: 'parallel' | 'serial';
  concurrency: number;
  useJimengLocal: boolean;
  perfMode: 'normal' | 'ultra';
}

function loadSettingsDraft(): SettingsDraft {
  return {
    apiKey: getPref('global_key', ''),
    lastImageModel: getPref('last_image_model', DEFAULT_IMAGE_MODEL),
    lastVideoModel: getPref('last_video_model', DEFAULT_VIDEO_MODEL),
    chatModel: getPref('chat_model', 'gpt-4o'),
    queueMode: getPref<'parallel' | 'serial'>('batch_queue_mode', 'parallel'),
    concurrency: Number(getPref('batch_concurrency', 1)) || 1,
    useJimengLocal: getPref('jimeng_use_local_file', false),
    perfMode: getPref<'normal' | 'ultra'>('global_performance_mode', 'normal'),
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/30 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-zinc-600">{label}</span>
      {children}
    </label>
  );
}

interface RadioProps<T extends string> {
  current: T;
  value: T;
  onSelect: (v: T) => void;
  children: ReactNode;
}
function Radio<T extends string>({ current, value, onSelect, children }: RadioProps<T>) {
  const active = current === value;
  return (
    <button
      type="button"
      className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100'
      }`}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}
