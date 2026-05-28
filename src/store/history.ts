import { createStore, del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';
import { getPref } from './prefs';

export type HistoryKind = 'image' | 'video' | 'analyze' | 'extract';
export type HistoryStatus = 'pending' | 'completed' | 'failed';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  kind: HistoryKind;
  nodeId: string;
  nodeKind: string;
  model: string;
  status?: HistoryStatus;
  prompt?: string;
  /** 生成结果 URL（图/视频） */
  content?: string;
  /** 同一次生成的全部候选图。 */
  contents?: string[];
  /** 用时（ms） */
  durationMs?: number;
  /** "1:1 · 2K" 之类的尺寸描述 */
  sizeDesc?: string;
  /** 参考图数量 */
  refsCount?: number;
  error?: string;
}

const historyStore = createStore('tapnow-history', 'entries');

interface HistoryState {
  entries: HistoryEntry[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  push: (e: Omit<HistoryEntry, 'id' | 'timestamp'>) => Promise<HistoryEntry>;
  create: (e: Omit<HistoryEntry, 'id' | 'timestamp'>) => HistoryEntry;
  update: (
    id: string,
    patch: Partial<Omit<HistoryEntry, 'id' | 'timestamp'>>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

function newEntryId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

async function loadAllEntries(): Promise<HistoryEntry[]> {
  try {
    const ks = await keys(historyStore);
    const rows = await Promise.all(
      ks.map((k) => get<HistoryEntry>(k as IDBValidKey, historyStore)),
    );
    return rows
      .filter((x): x is HistoryEntry => !!x)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export const useHistory = create<HistoryState>((setState, getState) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    const entries = await loadAllEntries();
    setState({ entries, hydrated: true });
  },

  push: async (input) => {
    const entry = getState().create(input);
    await set(entry.id, entry, historyStore);
    return entry;
  },

  create: (input) => {
    const entry: HistoryEntry = {
      ...input,
      id: newEntryId(),
      timestamp: Date.now(),
    };

    const limit = Number(getPref('history_limit', 100)) || 100;
    const next = [entry, ...getState().entries];
    // 超额裁掉最旧条目 + 从 IDB 删
    let trimmed = next;
    if (next.length > limit) {
      const drop = next.slice(limit);
      trimmed = next.slice(0, limit);
      for (const d of drop) {
        void del(d.id, historyStore);
      }
    }
    setState({ entries: trimmed });
    void set(entry.id, entry, historyStore);
    return entry;
  },

  update: async (id, patch) => {
    let nextEntry: HistoryEntry | undefined;
    setState((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== id) return e;
        nextEntry = { ...e, ...patch };
        return nextEntry;
      }),
    }));
    if (nextEntry) {
      await set(id, nextEntry, historyStore);
    }
  },

  remove: async (id) => {
    await del(id, historyStore);
    setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  },

  clear: async () => {
    const all = getState().entries;
    await Promise.all(all.map((e) => del(e.id, historyStore)));
    setState({ entries: [] });
  },
}));
