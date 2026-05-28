export const NODE_FRAME =
  'flex h-full w-full flex-col overflow-visible rounded-[22px] border bg-white/95 shadow-[0_18px_45px_rgba(24,24,27,0.10)] backdrop-blur transition-colors';
export const NODE_BORDER_IDLE = 'border-zinc-200';
export const NODE_BORDER_SELECTED = 'border-blue-500';
export const NODE_HEADER =
  'flex shrink-0 items-center gap-1.5 border-b border-zinc-100/80 bg-zinc-50/70 px-3 py-2 text-xs font-medium text-zinc-700';
export const NODE_BODY = 'min-h-0 flex-1 overflow-hidden';

export function frameClass(selected: boolean | undefined): string {
  return `${NODE_FRAME} ${selected ? NODE_BORDER_SELECTED : NODE_BORDER_IDLE}`;
}
