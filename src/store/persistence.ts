import { createStore, get, set } from 'idb-keyval';
import type { AppNode } from '@/types/node';
import type { ProjectSnapshot } from '@/types/project';
import { setPref } from './prefs';

const snapshotStore = createStore('tapnow-autosave', 'snapshots');
const assetStore = createStore('tapnow-images', 'assets');
const KEY = 'current';
const ASSET_REF_PREFIX = 'tapnow-asset://';
const memoryStores = new Map<string, Map<string, unknown>>();

interface StoredAsset {
  id: string;
  dataUrl: string;
  contentType?: string;
  byteLength: number;
  createdAt: number;
}

interface AssetExtraction {
  value: unknown;
  assetIds: string[];
}

export async function loadSnapshot(): Promise<ProjectSnapshot | null> {
  const snap = await idbGet<ProjectSnapshot>('snapshots', KEY, snapshotStore);
  if (!snap) return null;
  return {
    ...snap,
    nodes: (await restoreAssetRefs(snap.nodes)) as AppNode[],
  };
}

export async function saveSnapshot(s: ProjectSnapshot): Promise<void> {
  const { value, assetIdsByNode } = await extractSnapshotAssets(s.nodes);
  const stored: ProjectSnapshot = {
    ...s,
    nodes: value as AppNode[],
    assetIdsByNode,
  };
  await idbSet('snapshots', KEY, stored, snapshotStore);
  setPref('autosave_meta', { timestamp: s.savedAt, storage: 'idb' });
}

export async function putAsset(dataUrl: string): Promise<string> {
  const id = assetId(dataUrl);
  const existing = await idbGet<StoredAsset>('assets', id, assetStore);
  if (!existing) {
    await idbSet(
      'assets',
      id,
      {
        id,
        dataUrl,
        contentType: dataUrlContentType(dataUrl),
        byteLength: dataUrl.length,
        createdAt: Date.now(),
      },
      assetStore,
    );
  }
  return id;
}

export async function getAsset(id: string): Promise<string | null> {
  const asset = await idbGet<StoredAsset>('assets', id, assetStore);
  return asset?.dataUrl ?? null;
}

async function idbGet<T>(
  memoryStoreKey: string,
  key: IDBValidKey,
  store: Parameters<typeof get>[1],
): Promise<T | undefined> {
  if (!hasIndexedDB()) {
    return getMemoryStore(memoryStoreKey).get(String(key)) as T | undefined;
  }
  return get<T>(key, store);
}

async function idbSet(
  memoryStoreKey: string,
  key: IDBValidKey,
  value: unknown,
  store: Parameters<typeof set>[2],
): Promise<void> {
  if (!hasIndexedDB()) {
    getMemoryStore(memoryStoreKey).set(String(key), value);
    return;
  }
  await set(key, value, store);
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getMemoryStore(key: string): Map<string, unknown> {
  let store = memoryStores.get(key);
  if (!store) {
    store = new Map();
    memoryStores.set(key, store);
  }
  return store;
}

async function extractSnapshotAssets(nodes: AppNode[]): Promise<{
  value: unknown;
  assetIdsByNode: Record<string, string[]>;
}> {
  const assetIdsByNode: Record<string, string[]> = {};
  const extractedNodes = await Promise.all(
    nodes.map(async (node) => {
      const { value, assetIds } = await extractAssets(node);
      if (assetIds.length > 0) assetIdsByNode[node.id] = assetIds;
      return value;
    }),
  );
  return { value: extractedNodes, assetIdsByNode };
}

async function extractAssets(value: unknown): Promise<AssetExtraction> {
  if (typeof value === 'string') {
    if (!isInlineDataUrl(value)) return { value, assetIds: [] };
    const id = await putAsset(value);
    return { value: toAssetRef(id), assetIds: [id] };
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const assetIds: string[] = [];
    for (const item of value) {
      const extracted = await extractAssets(item);
      out.push(extracted.value);
      assetIds.push(...extracted.assetIds);
    }
    return { value: out, assetIds };
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const assetIds: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      const extracted = await extractAssets(item);
      out[key] = extracted.value;
      assetIds.push(...extracted.assetIds);
    }
    return { value: out, assetIds };
  }

  return { value, assetIds: [] };
}

async function restoreAssetRefs(value: unknown): Promise<unknown> {
  if (typeof value === 'string') {
    if (!isAssetRef(value)) return value;
    return (await getAsset(fromAssetRef(value))) ?? value;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => restoreAssetRefs(item)));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = await restoreAssetRefs(item);
    }
    return out;
  }

  return value;
}

function isInlineDataUrl(value: string): boolean {
  return /^data:[^,]+;base64,/.test(value);
}

function toAssetRef(id: string): string {
  return `${ASSET_REF_PREFIX}${id}`;
}

function isAssetRef(value: string): boolean {
  return value.startsWith(ASSET_REF_PREFIX);
}

function fromAssetRef(value: string): string {
  return value.slice(ASSET_REF_PREFIX.length);
}

function dataUrlContentType(dataUrl: string): string | undefined {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return match?.[1];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assetId(dataUrl: string): string {
  return `asset_${fnv1a(dataUrl).toString(36)}_${dataUrl.length.toString(36)}`;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
