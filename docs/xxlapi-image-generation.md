# XXLAPI 生图接口对接文档

本文档只覆盖当前开发库中已激活的图片生成模型。激活口径为：

- `abilities.enabled = 1`
- 对应 `channels.status = 1`
- `models.status = 1` 且未软删除
- 模型能力包含 `image_out=true`，或广场分类包含 `image_t2i` / `image_edit`

数据来源：本地开发库 `xxlapi`，检查时间：2026-05-17。

## 1. 通用接入约定

所有调用走 OpenAI 兼容协议，由客户端配置网关地址与 API Key。

```http
Authorization: Bearer ${apiKey}
```

`baseUrl` 不带末尾斜杠，示例：

```ts
const baseUrl = 'https://api.example.com';
```

图片生成接口：

```http
POST ${baseUrl}/v1/images/generations
Content-Type: application/json
```

图片编辑 / 图生图接口：

```http
POST ${baseUrl}/v1/images/edits
Content-Type: multipart/form-data 或 application/json
```

当前激活模型全部来自阿里渠道：

| 渠道 ID | 渠道名 | 类型 | 状态 |
|---:|---|---:|---:|
| 17 | 阿里系-图片生成模型-normal | 17 | 启用 |
| 18 | 阿里系-图片生成模型-VIP | 17 | 启用 |

## 2. 已激活模型清单

| 模型 | 任务类型 | 支持参考图 | 支持图片编辑 | 可用分组 | 渠道 |
|---|---|---:|---:|---|---|
| `qwen-image-2.0` | 文生图 | 是，最多 5 张 | 否 | `default`, `svip`, `vip`, `xxl` | 17 |
| `wan2.2-t2i-flash` | 文生图 | 否 | 否 | `default`, `svip`, `vip`, `xxl` | 17 |
| `wan2.2-t2i-plus` | 文生图 | 否 | 否 | `default`, `svip`, `vip`, `xxl` | 17 |
| `wan2.5-t2i-preview` | 文生图 | 否 | 否 | `default`, `svip`, `vip`, `xxl` | 17 |
| `wan2.6-t2i` | 文生图 | 否 | 否 | `default`, `svip`, `vip`, `xxl` | 17 |
| `wan2.7-image` | 文生图 / 图生图 / 图片编辑 | 是，最多 5 张 | 是 | `svip`, `vip`, `xxl` | 18 |
| `wan2.7-image-pro` | 文生图 / 图生图 / 图片编辑 | 是，最多 5 张 | 是 | `svip`, `vip`, `xxl` | 18 |

注意：

- `wan2.7-image` 和 `wan2.7-image-pro` 不在 `default` 分组中，普通默认分组用户不可用。
- 只有 `wan2.7-image` / `wan2.7-image-pro` 明确支持图片编辑分类 `image_edit`。
- `qwen-image-2.0` 支持图片输入参考，但当前分类是 `image_t2i` + `text_mm`，不要把它当作稳定的 `/v1/images/edits` 模型使用。

## 3. 路由规则

客户端根据模型和参考图数量选择 endpoint。

| 场景 | 模型 | 参考图 | endpoint | body |
|---|---|---:|---|---|
| 纯文生图 | 任意已激活模型 | 0 | `/v1/images/generations` | JSON |
| 参考图生成 | `qwen-image-2.0` | 1-5 | `/v1/images/generations` | JSON |
| 参考图生成 / 图片编辑 | `wan2.7-image` | 1-5 | `/v1/images/edits` | FormData 优先 |
| 参考图生成 / 图片编辑 | `wan2.7-image-pro` | 1-5 | `/v1/images/edits` | FormData 优先 |

推荐实现：

```ts
const IMAGE_EDIT_MODELS = new Set(['wan2.7-image', 'wan2.7-image-pro']);
const IMAGE_REFERENCE_GENERATION_MODELS = new Set(['qwen-image-2.0']);

export function routeImageRequest(model: string, referenceCount: number) {
  if (referenceCount > 0 && IMAGE_EDIT_MODELS.has(model)) {
    return {
      endpoint: '/v1/images/edits',
      bodyKind: 'form' as const,
    };
  }

  return {
    endpoint: '/v1/images/generations',
    bodyKind: 'json' as const,
  };
}
```

## 4. 文生图请求

适用于全部 7 个激活模型。

```http
POST /v1/images/generations
Content-Type: application/json
```

最小请求：

```json
{
  "model": "wan2.7-image",
  "prompt": "一张极简风格的白色工作台产品渲染图",
  "n": 1,
  "size": "1024x1024",
  "response_format": "url"
}
```

字段说明：

| 字段 | 必填 | 类型 | 说明 |
|---|---:|---|---|
| `model` | 是 | string | 已激活模型名 |
| `prompt` | 是 | string | 生成提示词 |
| `n` | 否 | number | 生成张数，默认 1 |
| `size` | 否 | string | 建议用 `1024x1024`、`1024x1792`、`1792x1024` |
| `response_format` | 否 | string | 建议 `url` |
| `watermark` | 否 | boolean | 上游支持时生效 |

响应：

```json
{
  "created": 1760000000,
  "data": [
    {
      "url": "https://example.com/generated.png"
    }
  ]
}
```

客户端读取时兼容 `url` 和 `b64_json`：

```ts
export function getImageOutputs(response: {
  data?: Array<{ url?: string; b64_json?: string }>;
}) {
  return (response.data ?? [])
    .map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''))
    .filter(Boolean);
}
```

## 5. 参考图生成

### 5.1 `qwen-image-2.0`

`qwen-image-2.0` 支持最多 5 张参考图，但仍走 `/v1/images/generations`。推荐用 JSON，把参考图 URL 或 data URL 放到 `image` 字段。

```json
{
  "model": "qwen-image-2.0",
  "prompt": "参考上传图片的构图，生成一张干净的产品海报",
  "image": [
    "https://example.com/ref-1.png",
    "https://example.com/ref-2.png"
  ],
  "n": 1,
  "size": "1024x1024",
  "response_format": "url"
}
```

实现约束：

- 参考图最多 5 张。
- 没有参考图时按普通文生图处理。
- 不要路由到 `/v1/images/edits`，避免和 `wan2.7-image*` 的图片编辑能力混淆。

### 5.2 `wan2.7-image` / `wan2.7-image-pro`

有参考图时走 `/v1/images/edits`，用 `multipart/form-data`。

```ts
const form = new FormData();
form.append('model', 'wan2.7-image-pro');
form.append('prompt', '保留主体姿态，改成赛博朋克风格海报');
form.append('n', '1');
form.append('size', '1024x1024');
form.append('response_format', 'url');

for (const file of referenceFiles.slice(0, 5)) {
  form.append('image', file);
}

const res = await fetch(`${baseUrl}/v1/images/edits`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
  body: form,
});
```

不要手动设置 `Content-Type`，浏览器会自动带上 multipart boundary。

## 6. 图片编辑请求

当前只对以下模型开放：

- `wan2.7-image`
- `wan2.7-image-pro`

```http
POST /v1/images/edits
Content-Type: multipart/form-data
```

字段说明：

| 字段 | 必填 | 类型 | 说明 |
|---|---:|---|---|
| `model` | 是 | string | `wan2.7-image` 或 `wan2.7-image-pro` |
| `prompt` | 是 | string | 编辑指令 |
| `image` | 是 | File / Blob | 主参考图；可重复传多张，最多 5 张 |
| `mask` | 否 | File / Blob | 蒙版；当前不要强依赖，按可选处理 |
| `n` | 否 | number | 默认 1 |
| `size` | 否 | string | 输出尺寸 |
| `response_format` | 否 | string | 建议 `url` |
| `watermark` | 否 | boolean | 上游支持时生效 |

响应同文生图接口：

```json
{
  "created": 1760000000,
  "data": [
    {
      "url": "https://example.com/edited.png"
    }
  ]
}
```

## 7. 前端模型定义

建议在 `node-canvas-studio` 的模型库中只预置当前激活模型：

```ts
export type ImageModelId =
  | 'qwen-image-2.0'
  | 'wan2.2-t2i-flash'
  | 'wan2.2-t2i-plus'
  | 'wan2.5-t2i-preview'
  | 'wan2.6-t2i'
  | 'wan2.7-image'
  | 'wan2.7-image-pro';

export interface ActiveImageModel {
  id: ImageModelId;
  name: ImageModelId;
  provider: 'ali';
  modality: 'image';
  supportsReference: boolean;
  supportsEdit: boolean;
  maxReferenceImages: number;
  groups: string[];
}

export const ACTIVE_IMAGE_MODELS: ActiveImageModel[] = [
  {
    id: 'qwen-image-2.0',
    name: 'qwen-image-2.0',
    provider: 'ali',
    modality: 'image',
    supportsReference: true,
    supportsEdit: false,
    maxReferenceImages: 5,
    groups: ['default', 'svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.2-t2i-flash',
    name: 'wan2.2-t2i-flash',
    provider: 'ali',
    modality: 'image',
    supportsReference: false,
    supportsEdit: false,
    maxReferenceImages: 0,
    groups: ['default', 'svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.2-t2i-plus',
    name: 'wan2.2-t2i-plus',
    provider: 'ali',
    modality: 'image',
    supportsReference: false,
    supportsEdit: false,
    maxReferenceImages: 0,
    groups: ['default', 'svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.5-t2i-preview',
    name: 'wan2.5-t2i-preview',
    provider: 'ali',
    modality: 'image',
    supportsReference: false,
    supportsEdit: false,
    maxReferenceImages: 0,
    groups: ['default', 'svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.6-t2i',
    name: 'wan2.6-t2i',
    provider: 'ali',
    modality: 'image',
    supportsReference: false,
    supportsEdit: false,
    maxReferenceImages: 0,
    groups: ['default', 'svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.7-image',
    name: 'wan2.7-image',
    provider: 'ali',
    modality: 'image',
    supportsReference: true,
    supportsEdit: true,
    maxReferenceImages: 5,
    groups: ['svip', 'vip', 'xxl'],
  },
  {
    id: 'wan2.7-image-pro',
    name: 'wan2.7-image-pro',
    provider: 'ali',
    modality: 'image',
    supportsReference: true,
    supportsEdit: true,
    maxReferenceImages: 5,
    groups: ['svip', 'vip', 'xxl'],
  },
];
```

## 8. 客户端校验规则

提交前做轻量校验：

```ts
export function validateImageRequest(model: ActiveImageModel, referenceCount: number) {
  if (referenceCount > 0 && !model.supportsReference) {
    throw new Error(`${model.name} 不支持参考图`);
  }

  if (referenceCount > model.maxReferenceImages) {
    throw new Error(`${model.name} 最多支持 ${model.maxReferenceImages} 张参考图`);
  }
}
```

建议 UI 行为：

- 选择不支持参考图的模型时，隐藏或禁用参考图上传。
- `default` 分组用户不要展示 `wan2.7-image` / `wan2.7-image-pro`。
- 有参考图且模型是 `wan2.7-image*` 时，按钮文案可显示为“编辑图片”或“参考生成”。
- 没有参考图时，所有模型都按“生成图片”处理。

## 9. 错误处理

网关错误形状遵循 OpenAI 风格：

```json
{
  "error": {
    "message": "error message",
    "type": "invalid_request_error",
    "code": "invalid_request"
  }
}
```

客户端建议：

- `400` / `401` / `403`：直接展示错误，不重试。
- `429`：提示频率限制，可延迟重试。
- `5xx`：最多重试 1 次。
- 请求超时：允许用户取消；不要重复提交相同节点任务。

## 10. 最小封装示例

```ts
interface GenerateImageInput {
  baseUrl: string;
  apiKey: string;
  model: ActiveImageModel;
  prompt: string;
  referenceFiles?: File[];
  size?: string;
  n?: number;
}

export async function generateImage(input: GenerateImageInput) {
  const referenceFiles = input.referenceFiles ?? [];
  validateImageRequest(input.model, referenceFiles.length);

  const route = routeImageRequest(input.model.name, referenceFiles.length);
  const url = `${input.baseUrl}${route.endpoint}`;

  if (route.bodyKind === 'form') {
    const form = new FormData();
    form.append('model', input.model.name);
    form.append('prompt', input.prompt);
    form.append('n', String(input.n ?? 1));
    form.append('size', input.size ?? '1024x1024');
    form.append('response_format', 'url');

    for (const file of referenceFiles.slice(0, input.model.maxReferenceImages)) {
      form.append('image', file);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      throw await normalizeApiError(res);
    }

    return getImageOutputs(await res.json());
  }

  const body: Record<string, unknown> = {
    model: input.model.name,
    prompt: input.prompt,
    n: input.n ?? 1,
    size: input.size ?? '1024x1024',
    response_format: 'url',
  };

  if (input.model.name === 'qwen-image-2.0' && referenceFiles.length > 0) {
    body.image = await Promise.all(referenceFiles.slice(0, 5).map(fileToDataUrl));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await normalizeApiError(res);
  }

  return getImageOutputs(await res.json());
}
```

`normalizeApiError` 和 `fileToDataUrl` 可放在现有 `src/api/client.ts` / `src/api/template.ts` 中复用。

