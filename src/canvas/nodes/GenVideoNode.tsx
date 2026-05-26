import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AtSign, Music2, Video } from 'lucide-react';
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

type MentionMediaType = 'image' | 'video' | 'audio';

interface MentionCandidate {
  id: string;
  type: MentionMediaType;
  label: string;
  url: string;
  previewUrl?: string;
}

function isWan27I2V(model: string): boolean {
  const name = model.toLowerCase();
  return name.startsWith('wan2.7') && name.includes('i2v');
}

function isHappyHorse(model: string): boolean {
  return model.toLowerCase().startsWith('happyhorse-1.0-');
}

function typeLabel(type: MentionMediaType): string {
  if (type === 'image') return '图片';
  if (type === 'video') return '视频';
  return '音频';
}

function createMentionCardHtml(item: MentionCandidate): string {
  const media = item.type === 'image'
    ? `<img src="${escapeAttr(item.previewUrl || item.url)}" alt="" style="width:22px;height:22px;border-radius:5px;object-fit:cover;display:inline-block;flex-shrink:0;" />`
    : `<span style="display:inline-flex;width:22px;height:22px;border-radius:5px;align-items:center;justify-content:center;background:#e5e7eb;color:${item.type === 'video' ? '#374151' : '#2563eb'};font-size:12px;line-height:1;">${item.type === 'video' ? '▶' : '♪'}</span>`;
  return `<span contenteditable="false" data-mention="media" data-mention-type="${item.type}" data-mention-label="${escapeAttr(item.label)}" data-mention-url="${escapeAttr(item.url)}" style="display:inline-flex;align-items:center;gap:4px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:2px 7px;margin:0 2px;cursor:default;user-select:none;vertical-align:middle;white-space:nowrap;font-size:12px;color:#374151;">${media}<span>${escapeHtml(item.label)}</span></span>&nbsp;`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function extractPromptText(root: HTMLElement | null): string {
  if (!root) return '';

  const walk = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (el.dataset.mention === 'media') return el.dataset.mentionLabel || '';
    return Array.from(el.childNodes).map(walk).join('');
  };

  return Array.from(root.childNodes)
    .map(walk)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeTrailingAt(range: Range, root: HTMLElement): void {
  const before = range.cloneRange();
  before.setStart(root, 0);
  if (!before.toString().endsWith('@')) return;

  if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
    range.setStart(range.startContainer, range.startOffset - 1);
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastText: Text | null = null;
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    if (text === range.startContainer) break;
    if (text.data.length > 0) lastText = text;
    current = walker.nextNode();
  }
  if (lastText?.data.endsWith('@')) {
    range.setStart(lastText, lastText.data.length - 1);
  }
}

function textBeforeSelection(root: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return '';
  const before = range.cloneRange();
  before.setStart(root, 0);
  return before.toString();
}

function shouldKeepMentionOpen(root: HTMLElement): boolean {
  const before = textBeforeSelection(root);
  return /(^|\s)@$/.test(before);
}

function ReferenceMediaCard({ item }: { item: MentionCandidate }) {
  return (
    <div className="group relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="h-full w-full">
        {item.type === 'image' ? (
          <img
            src={item.previewUrl || item.url}
            alt={item.label}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-500">
            {item.type === 'video' ? (
              <Video className="h-5 w-5" />
            ) : (
              <Music2 className="h-5 w-5 text-blue-600" />
            )}
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[10px] font-medium leading-tight text-white">
        {item.label}
      </div>
    </div>
  );
}

function PromptMentionEditor({
  value,
  html,
  placeholder,
  candidates,
  disabled,
  onChange,
}: {
  value: string;
  html?: string;
  placeholder: string;
  candidates: MentionCandidate[];
  disabled?: boolean;
  onChange: (next: { text: string; html: string }) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextHtml = html || escapeHtml(value || '');
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
  }, [html, value]);

  const sync = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange({ text: extractPromptText(editor), html: editor.innerHTML });
    if (open && !shouldKeepMentionOpen(editor)) setOpen(false);
  }, [onChange, open]);

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return;
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    const host = editor.getBoundingClientRect();
    setPos({
      top: Math.max(28, rect.bottom - host.top + 6),
      left: Math.max(0, Math.min(rect.left - host.left, host.width - 220)),
    });
  }, []);

  const openMention = useCallback(() => {
    window.setTimeout(() => {
      rememberSelection();
      setOpen(true);
    }, 0);
  }, [rememberSelection]);

  const insertMention = useCallback(
    (item: MentionCandidate) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      let range = savedRangeRef.current;
      if (!range || !editor.contains(range.startContainer)) {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      removeTrailingAt(range, editor);
      range.deleteContents();

      const temp = document.createElement('span');
      temp.innerHTML = createMentionCardHtml(item);
      const fragment = document.createDocumentFragment();
      let last: ChildNode | null = null;
      while (temp.firstChild) {
        last = fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      savedRangeRef.current = null;
      setOpen(false);
      sync();
    },
    [sync],
  );

  return (
    <div className="relative">
      <div
        ref={editorRef}
        className="nodrag min-h-20 max-h-32 overflow-y-auto rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs leading-5 text-zinc-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)]"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onMouseUp={rememberSelection}
        onKeyUp={(e) => {
          rememberSelection();
          if (e.key === 'Escape') setOpen(false);
        }}
        onBeforeInput={(e) => {
          if ((e.nativeEvent as InputEvent).data === '@') openMention();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          sync();
        }}
      />
      <button
        type="button"
        className="nodrag absolute bottom-1 right-1 rounded-md bg-zinc-100 p-1 text-zinc-500 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          rememberSelection();
          setOpen((current) => !current);
        }}
        disabled={disabled}
        title="插入参考素材"
      >
        <AtSign className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="nodrag absolute z-50 max-h-64 w-56 overflow-y-auto rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-xl backdrop-blur"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            可用@内容
          </div>
          {candidates.length > 0 ? (
            candidates.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-zinc-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(item)}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.previewUrl || item.url}
                    alt={item.label}
                    className="h-8 w-8 rounded-lg object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                    {item.type === 'video' ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <Music2 className="h-4 w-4 text-blue-600" />
                    )}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-zinc-700">
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-zinc-400">
                    {typeLabel(item.type)}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-4 text-center text-xs text-zinc-400">
              先连接图片或音频节点
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const refs = upstream.referenceImages;
  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const items: MentionCandidate[] = [];
    refs.forEach((url, index) => {
      items.push({
        id: `image-${index}-${url}`,
        type: 'image',
        label: `图片${index + 1}`,
        url,
        previewUrl: url,
      });
    });
    if (upstream.videoUrl) {
      items.push({
        id: `video-0-${upstream.videoUrl}`,
        type: 'video',
        label: '视频1',
        url: upstream.videoUrl,
      });
    }
    upstream.audioUrls.forEach((url, index) => {
      items.push({
        id: `audio-${index}-${url}`,
        type: 'audio',
        label: `音频${index + 1}`,
        url,
      });
    });
    return items;
  }, [refs, upstream.audioUrls, upstream.videoUrl]);

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
        <PromptMentionEditor
          value={settings.videoPrompt}
          html={settings.videoPromptHtml}
          placeholder={upstream.prompt ? `(上游 prompt: ${upstream.prompt})` : 'video prompt，输入 @ 调用参考素材'}
          candidates={mentionCandidates}
          disabled={isBusy}
          onChange={({ text, html }) =>
            patchSettings<'gen-video'>(nid, {
              videoPrompt: text,
              videoPromptHtml: html,
            })
          }
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
        {mentionCandidates.length > 0 && (
          <div className="flex flex-col gap-1 rounded border border-zinc-200 bg-zinc-50 p-1">
            {refs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {mentionCandidates
                  .filter((item) => item.type === 'image')
                  .slice(0, videoMode === 'first-last-frame' ? 2 : 5)
                  .map((item) => (
                    <ReferenceMediaCard key={item.id} item={item} />
                  ))}
              </div>
            )}
            {(upstream.videoUrl || upstream.audioUrls.length > 0) && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {mentionCandidates
                  .filter((item) => item.type !== 'image')
                  .slice(0, 4)
                  .map((item) => (
                    <ReferenceMediaCard key={item.id} item={item} />
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
