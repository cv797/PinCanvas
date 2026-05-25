import type { ModelDef } from '@/types/model';

export const DEFAULT_MODELS: ModelDef[] = [
  // xicily / new-api OpenAI-compatible
  {
    id: 'wan2.7-image',
    name: 'wan2.7-image',
    provider: 'openai',
    modality: 'image',
    ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1024x1024'],
    group: 'Wan',
  },
  {
    id: 'wan2.7-image-pro',
    name: 'wan2.7-image-pro',
    provider: 'openai',
    modality: 'image',
    ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: ['1024x1024'],
    group: 'Wan',
  },

  // OpenAI 同源
  { id: 'gpt-4o', name: 'gpt-4o', provider: 'openai', modality: 'chat' },
  { id: 'gpt-5.2', name: 'gpt-5.2', provider: 'openai', modality: 'chat' },
  { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5', provider: 'openai', modality: 'chat' },
  {
    id: 'gpt-4o-image',
    name: 'gpt-4o-image',
    provider: 'openai',
    modality: 'image',
    supportsEdit: true,
  },

  // Sora 视频
  {
    id: 'wan2.6-r2v-flash',
    name: 'wan2.6-r2v-flash',
    provider: 'openai',
    modality: 'video',
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'Wan',
  },
  {
    id: 'wan2.7-i2v',
    name: 'wan2.7-i2v',
    provider: 'openai',
    modality: 'video',
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'Wan',
  },
  {
    id: 'kling/kling-v3-omni-video-generation',
    name: 'kling/kling-v3-omni-video-generation',
    provider: 'openai',
    modality: 'video',
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'Kling',
  },
  {
    id: 'seedance-2',
    name: 'seedance-2',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'Seedance',
  },
  {
    id: 'doubao-seedance-2-0-260128',
    name: 'doubao-seedance-2-0-260128',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'Seedance',
  },
  {
    id: 'seedance-2-fast',
    name: 'seedance-2-fast',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['4s', '5s', '6s', '7s', '8s', '9s', '10s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p'],
    group: 'Seedance',
  },
  {
    id: 'happyhorse-1.0-r2v',
    name: 'happyhorse-1.0-r2v',
    displayName: 'HappyHorse(多图参考)',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', '11s', '12s', '13s', '14s', '15s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'HappyHorse',
  },
  {
    id: 'happyhorse-1.0-t2v',
    name: 'happyhorse-1.0-t2v',
    displayName: 'HappyHorse(文生视频)',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', '11s', '12s', '13s', '14s', '15s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'HappyHorse',
  },
  {
    id: 'happyhorse-1.0-i2v',
    name: 'happyhorse-1.0-i2v',
    displayName: 'HappyHorse(图生视频)',
    provider: 'openai',
    modality: 'video',
    async: true,
    durations: ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', '11s', '12s', '13s', '14s', '15s'],
    ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['720p', '1080p'],
    group: 'HappyHorse',
  },

  // Jimeng（即梦）
  {
    id: 'nano-banana',
    name: 'nano-banana',
    provider: 'jimeng',
    modality: 'image',
    supportsEdit: true,
    group: 'Banana',
  },
  {
    id: 'nano-banana-2',
    name: 'nano-banana-2',
    provider: 'jimeng',
    modality: 'image',
    supportsEdit: true,
    async: true,
    group: 'Banana',
  },
  {
    id: 'nanobananapro',
    name: 'nanobananapro',
    provider: 'jimeng',
    modality: 'image',
    supportsEdit: true,
    group: 'Banana',
  },
  {
    id: 'jimeng-xl',
    name: 'jimeng-xl',
    provider: 'jimeng',
    modality: 'image',
    group: 'Jimeng',
  },
  {
    id: 'jimeng-xl-pro',
    name: 'jimeng-xl-pro',
    provider: 'jimeng',
    modality: 'image',
    group: 'Jimeng',
  },
  // Flux
  {
    id: 'flux-kontext',
    name: 'flux-kontext',
    provider: 'openai',
    modality: 'image',
    supportsEdit: true,
    group: 'Flux',
  },
  {
    id: 'flux-kontext-pro',
    name: 'flux-kontext-pro',
    provider: 'openai',
    modality: 'image',
    supportsEdit: true,
    group: 'Flux',
  },
  {
    id: 'flux-pro',
    name: 'flux-pro',
    provider: 'openai',
    modality: 'image',
    group: 'Flux',
  },

  // Qwen
  {
    id: 'qwen-image',
    name: 'qwen-image',
    provider: 'qwen',
    modality: 'image',
    supportsEdit: true,
  },

  // Yunwu (Gemini)
  {
    id: 'gemini-3-pro-image-preview',
    name: 'gemini-3-pro-image-preview',
    provider: 'yunwu',
    modality: 'image',
  },

  // Midjourney
  { id: 'mj-v6', name: 'MJ V6', provider: 'midjourney', modality: 'image' },

  // Deepseek
  {
    id: 'deepseek-v3-1',
    name: 'deepseek-v3-1-250821',
    provider: 'deepseek',
    modality: 'chat',
  },
];

const BY_ID: Map<string, ModelDef> = new Map(DEFAULT_MODELS.map((m) => [m.id, m]));

const USER_LIBRARY_KEY = 'tapnow_model_library';
const OVERRIDES_KEY = 'tapnow_model_overrides';

/**
 * 查找模型：先在 DEFAULT_MODELS 找；找不到读 localStorage 用户库 fallback。
 * 不依赖 React state，可在 trigger / 非 hook 上下文调用。
 */
export function getModelDef(id: string): ModelDef | undefined {
  const def = BY_ID.get(id);
  if (def) return applyModelOverride(id, def);
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_LIBRARY_KEY) : null;
    if (!raw) return undefined;
    const userModels = JSON.parse(raw) as ModelDef[];
    return Array.isArray(userModels) ? userModels.find((m) => m.id === id) : undefined;
  } catch {
    return undefined;
  }
}

export function getModelDisplayName(model: Pick<ModelDef, 'displayName' | 'name' | 'id'>): string {
  return model.displayName || model.name || model.id;
}

function applyModelOverride(id: string, model: ModelDef): ModelDef {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(OVERRIDES_KEY) : null;
    if (!raw) return model;
    const overrides = JSON.parse(raw) as Record<string, Partial<ModelDef>>;
    const override = overrides?.[id];
    return override ? { ...model, ...override } : model;
  } catch {
    return model;
  }
}
