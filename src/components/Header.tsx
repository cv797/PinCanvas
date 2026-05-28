import {
  Box,
  Clock,
  RotateCcw,
  RotateCw,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCanvas, useTemporal } from '@/store/canvas';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

export function Header({
  onOpenSettings,
  onOpenHistory,
  historyCount,
}: HeaderProps) {
  const onUndo = () => {
    useTemporal.getState().undo();
  };
  const onRedo = () => {
    useTemporal.getState().redo();
  };
  const onClear = () => {
    if (window.confirm('清空画布？此操作可用 Cmd+Z 撤销。')) {
      useCanvas.getState().clear();
    }
  };

  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
          <Box className="h-5 w-5" />
        </div>
        <span className="whitespace-nowrap text-[17px] font-semibold leading-none text-zinc-900">
          XXL Canvas
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={onOpenHistory}
          title="生成历史"
        >
          <Clock className="h-3.5 w-3.5" />
          历史
          {historyCount > 0 && (
            <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">
              {historyCount}
            </span>
          )}
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-200" />
        <IconBtn onClick={onUndo} title="撤销 (Cmd+Z)">
          <RotateCcw className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={onRedo} title="重做 (Shift+Cmd+Z)">
          <RotateCw className="h-3.5 w-3.5" />
        </IconBtn>
        <span className="mx-1 h-4 w-px bg-zinc-200" />
        <IconBtn onClick={onClear} title="清空画布">
          <Trash2 className="h-3.5 w-3.5" />
          <span className="text-xs">清空</span>
        </IconBtn>
        <span className="mx-1 h-4 w-px bg-zinc-200" />
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={onOpenSettings}
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          API 设置
        </button>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
