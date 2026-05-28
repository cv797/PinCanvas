import { createStore, del, get, keys, set } from 'idb-keyval';
import { create } from 'zustand';

export interface Character {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  imageUrl?: string;
  createdAt: number;
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  imageUrl?: string;
  createdAt: number;
}

const charStore = createStore('tapnow-library', 'characters');
const sceneStore = createStore('tapnow-library', 'scenes');

interface LibraryState {
  characters: Character[];
  scenes: Scene[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsertCharacter: (c: Character) => Promise<void>;
  removeCharacter: (id: string) => Promise<void>;
  patchCharacter: (id: string, patch: Partial<Character>) => Promise<void>;
  upsertScene: (s: Scene) => Promise<void>;
  removeScene: (id: string) => Promise<void>;
  patchScene: (id: string, patch: Partial<Scene>) => Promise<void>;
}

async function loadAllChars(): Promise<Character[]> {
  try {
    const ks = await keys(charStore);
    const rows = await Promise.all(
      ks.map((k) => get<Character>(k as IDBValidKey, charStore)),
    );
    return rows.filter((x): x is Character => !!x);
  } catch {
    return [];
  }
}

async function loadAllScenes(): Promise<Scene[]> {
  try {
    const ks = await keys(sceneStore);
    const rows = await Promise.all(
      ks.map((k) => get<Scene>(k as IDBValidKey, sceneStore)),
    );
    return rows.filter((x): x is Scene => !!x);
  } catch {
    return [];
  }
}

export const useLibrary = create<LibraryState>((setState, getState) => ({
  characters: [],
  scenes: [],
  hydrated: false,

  hydrate: async () => {
    const [characters, scenes] = await Promise.all([loadAllChars(), loadAllScenes()]);
    setState({
      characters: characters.sort((a, b) => a.createdAt - b.createdAt),
      scenes: scenes.sort((a, b) => a.createdAt - b.createdAt),
      hydrated: true,
    });
  },

  upsertCharacter: async (c) => {
    await set(c.id, c, charStore);
    setState((s) => {
      const i = s.characters.findIndex((x) => x.id === c.id);
      const next = i >= 0 ? s.characters.map((x) => (x.id === c.id ? c : x)) : [...s.characters, c];
      return { characters: next };
    });
  },

  removeCharacter: async (id) => {
    await del(id, charStore);
    setState((s) => ({ characters: s.characters.filter((x) => x.id !== id) }));
  },

  patchCharacter: async (id, patch) => {
    const cur = getState().characters.find((x) => x.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await set(id, next, charStore);
    setState((s) => ({
      characters: s.characters.map((x) => (x.id === id ? next : x)),
    }));
  },

  upsertScene: async (s2) => {
    await set(s2.id, s2, sceneStore);
    setState((s) => {
      const i = s.scenes.findIndex((x) => x.id === s2.id);
      const next = i >= 0 ? s.scenes.map((x) => (x.id === s2.id ? s2 : x)) : [...s.scenes, s2];
      return { scenes: next };
    });
  },

  removeScene: async (id) => {
    await del(id, sceneStore);
    setState((s) => ({ scenes: s.scenes.filter((x) => x.id !== id) }));
  },

  patchScene: async (id, patch) => {
    const cur = getState().scenes.find((x) => x.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await set(id, next, sceneStore);
    setState((s) => ({
      scenes: s.scenes.map((x) => (x.id === id ? next : x)),
    }));
  },
}));

export function libraryId(prefix: 'char' | 'scene'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
