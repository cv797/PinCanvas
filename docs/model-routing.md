# 模型路由

决定**任务 → endpoint → 请求形状**。本表是重写时的"分支决策表"，单元测试要覆盖每一行。

## 1. 决策表

输入：`task.type`（image / video / chat）+ `model.name` + 节点是否有 `referenceImages` / `mask`。

| 序 | 任务 | 模型名匹配 | referenceImages | 端点 | Content-Type | 备注 |
|---|---|---|---|---|---|---|
| 1 | image | 任意 | 0 张 | `/v1/images/generations` | JSON | 纯文生图 |
| 2 | image | `banana` ∪ `edit` ∪ `qwen` 且 **不含** `nano-banana-2` | ≥ 1 张 | `/v1/images/edits` | FormData | 同步图生图 |
| 3 | image | 含 `nano-banana-2` | ≥ 1 张 | `/v1/images/edits?async=true` | FormData | 异步，需轮询 |
| 4 | image | 含 `gpt-image` ∪ `gpt-4o-image` | 任意 | `/v1/images/generations` | JSON | GPT 的图片端点把图片作为 message |
| 5 | image | 含 `flux` | ≥ 1 张 | `/v1/images/generations` | JSON | flux-kontext 支持图生图，但走 generations 端点把 image 当字段 |
| 6 | image | 含 `mj` ∪ `midjourney` | 任意 | provider 私有 | JSON | MJ 走自有协议 |
| 7 | image | provider = `jimeng` 且 `tapnow_jimeng_use_local_file=true` | ≥ 1 张 | `/v1/images/edits` | FormData | 远端 URL 会被先 fetch 成 Blob 再上传 |
| 8 | video | 含 `sora` | 任意 | `/v1/videos/generations` | JSON | prompt 中 `@name` → `@{name}` |
| 9 | video | 其他视频模型 | 任意 | `/v1/videos/generations` | JSON | 默认走 OpenAI 兼容 |
| 10 | chat | 任意 | — | `/v1/chat/completions` | JSON | |

**判定优先级**：6 → 3 → 7 → 2 → 4 → 5 → 1（即先排除 MJ / 异步 / Jimeng 本地，再判普通图生图）。

## 2. 模型清单（启动时默认入库）

```ts
// src/types/model.ts
export type Provider = 'openai' | 'jimeng' | 'midjourney' | 'qwen' | 'deepseek' | 'yunwu' | 'custom';
export type Modality = 'image' | 'video' | 'chat';

export interface ModelDef {
  id: string;
  name: string;                  // 调用时传给 API 的 model 字段
  provider: Provider;
  modality: Modality;
  /** 是否支持图生图 / inpainting */
  supportsEdit?: boolean;
  /** 是否异步（需轮询） */
  async?: boolean;
  /** 支持的 ratio 集合（空 = 任意） */
  ratios?: string[];
  /** 支持的 resolution 集合 */
  resolutions?: string[];
  /** 视频专属：可选时长 */
  durations?: string[];
  /** 默认并发上限 */
  defaultImageConcurrency?: number;
  /** UI 展示分组 */
  group?: string;
}
```

参考清单（M0 已知）：

```ts
const DEFAULT_MODELS: ModelDef[] = [
  // === OpenAI 同源 ===
  { id: 'gpt-4o',      name: 'gpt-4o',      provider: 'openai', modality: 'chat'  },
  { id: 'gpt-5.2',     name: 'gpt-5.2',     provider: 'openai', modality: 'chat'  },
  { id: 'gpt-4o-image',name: 'gpt-4o-image',provider: 'openai', modality: 'image', supportsEdit: true },

  // === Sora 视频 ===
  { id: 'sora-2',      name: 'sora-2',      provider: 'openai', modality: 'video', durations: ['5s','10s'],   ratios: ['16:9','9:16','1:1'], resolutions: ['720p','1080p'] },
  { id: 'sora-2-pro',  name: 'sora-2-pro',  provider: 'openai', modality: 'video', durations: ['15s','25s'],  ratios: ['16:9','9:16','1:1'], resolutions: ['1080p','2K'] },

  // === Jimeng（即梦）系 ===
  { id: 'nano-banana',     name: 'nano-banana',     provider: 'jimeng', modality: 'image', supportsEdit: true,                 group: 'Banana' },
  { id: 'nano-banana-2',   name: 'nano-banana-2',   provider: 'jimeng', modality: 'image', supportsEdit: true, async: true,    group: 'Banana' },
  { id: 'nanobananapro',   name: 'nanobananapro',   provider: 'jimeng', modality: 'image', supportsEdit: true,                 group: 'Banana' },
  { id: 'jimeng-xl',       name: 'jimeng-xl',       provider: 'jimeng', modality: 'image',                                     group: 'Jimeng' },
  { id: 'jimeng-xl-pro',   name: 'jimeng-xl-pro',   provider: 'jimeng', modality: 'image',                                     group: 'Jimeng' },
  { id: 'jimeng-video-sora2', name: 'jimeng-video-sora2', provider: 'jimeng', modality: 'video', group: 'Jimeng' },

  // === Flux ===
  { id: 'flux-kontext',     name: 'flux-kontext',     provider: 'openai', modality: 'image', supportsEdit: true, group: 'Flux' },
  { id: 'flux-kontext-pro', name: 'flux-kontext-pro', provider: 'openai', modality: 'image', supportsEdit: true, group: 'Flux' },

  // === Qwen ===
  { id: 'qwen-image',       name: 'qwen-image',       provider: 'qwen',  modality: 'image', supportsEdit: true },

  // === Gemini（via yunwu 网关） ===
  { id: 'gemini-3-pro-image-preview', name: 'gemini-3-pro-image-preview', provider: 'yunwu', modality: 'image' },

  // === Midjourney ===
  { id: 'mj-v6',            name: 'MJ V6',            provider: 'midjourney', modality: 'image' },

  // === Deepseek ===
  { id: 'deepseek-v3-1',    name: 'deepseek-v3-1-250821', provider: 'deepseek', modality: 'chat' },
];
```

## 3. 路由函数签名（重写目标）

```ts
// src/api/model-routing.ts
export interface RouteResult {
  endpoint: string;
  method: 'POST';
  bodyKind: 'json' | 'form';
  async?: boolean;
  /** 请求体模板（含 {{var}} 占位符） */
  bodyTemplate: Record<string, unknown> | FormDataTemplate;
}

export function routeRequest(
  task: GenerationTask,
  model: ModelDef,
  ctx: { hasReferenceImages: boolean; hasMask: boolean; useJimengLocalFile: boolean },
): RouteResult;
```

测试用例至少覆盖：

```
test('image + no ref + flux-pro → generations json')
test('image + 1 ref + nano-banana → edits form sync')
test('image + 1 ref + nano-banana-2 → edits?async=true form async')
test('image + 2 ref + qwen-image → edits form')
test('image + 1 ref + gpt-image → generations json (as message)')
test('image + 1 ref + mj-v6 → midjourney provider')
test('image + 1 ref + jimeng-xl + useJimengLocalFile=true → edits form blob')
test('video + sora-2 + prompt with @hero → videos/generations, prompt rewritten')
test('chat → chat/completions')
```

## 4. Provider 特殊行为

### 4.1 OpenAI（含同源网关）
- 标准协议，无特殊处理。
- Sora 模型在 `prompt` 中需要把 `@name` → `@{name}`（角色占位）。

### 4.2 Jimeng（即梦）
- 默认走 OpenAI 兼容协议。
- 若开关 `tapnow_jimeng_use_local_file=true` 且参考图是 http(s) URL：
  - fetch 远端图 → 转 Blob → 用 FormData 上传（绕开远端鉴权问题）

### 4.3 Midjourney
- 不走 `/v1/images/*`，而是 provider 的私有 endpoint（submit / fetch result）。
- 结果是 4 张拼图，客户端 split：`mjImages = [tl, tr, bl, br]`，`mjOriginalUrl = 原图`。

### 4.4 Qwen
- 用 `/v1/images/edits` 但部分实现用 `image_size` 替代 `size`，重写时两者都发，由后端忽略多余字段。

### 4.5 Yunwu（Gemini 网关）
- 同 OpenAI 兼容，仅 model 名识别。

## 5. 全局开关

| localStorage 键 | 类型 | 影响 |
|---|---|---|
| `tapnow_jimeng_use_local_file` | `'true' \| 'false'` | 见 4.2 |
| `tapnow_global_key` | string | 兜底 apiKey（节点未配 apiConfig 时用） |
| `tapnow_api_configs` | JSON | 各 provider 的 url/key 覆盖 |
| `tapnow_api_blacklist` | JSON | 临时禁用的 endpoint |
| `tapnow_api_suspend` | JSON | 临时挂起（如冷却中） |
