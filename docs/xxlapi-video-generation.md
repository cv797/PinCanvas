# XXLAPI 视频生成接口对接文档

本文档只覆盖当前开发库中已激活的视频生成模型。激活口径为：

- `abilities.enabled = 1`
- 对应 `channels.status = 1`
- `models.status = 1` 且未软删除
- 模型能力包含 `video_out=true`，或广场分类包含 `video_t2v` / `video_i2v`

数据来源：本地开发库 `xxlapi`，检查时间：2026-05-17。

## 1. 通用接入约定

所有视频任务都是异步任务。创建任务后立即返回公开任务 ID，客户端再轮询任务状态。

```http
Authorization: Bearer ${apiKey}
Content-Type: application/json
```

推荐优先使用 OpenAI 兼容视频接口：

```http
POST ${baseUrl}/v1/videos
GET  ${baseUrl}/v1/videos/{task_id}
GET  ${baseUrl}/v1/videos/{task_id}/content
```

项目兼容接口也可用：

```http
POST ${baseUrl}/v1/video/generations
GET  ${baseUrl}/v1/video/generations/{task_id}
```

两套提交接口走同一套任务系统。差异在查询返回：

- `/v1/videos/{task_id}` 返回 OpenAI Video 风格对象。
- `/v1/video/generations/{task_id}` 返回网关通用 `TaskResponse<TaskDto>`。

## 2. 已激活模型清单

| 模型 | 类型 | 输入能力 | 可用分组 | 渠道 |
|---|---|---|---|---|
| `doubao-seedance-2-0-260128` | 文生视频 / 图生视频 | 图片、视频、音频参考 | `xxl` | 19: `xxl` |
| `kling/kling-v3-omni-video-generation` | 文生视频 / 图生视频 | 图片、视频参考 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `seedance-2` | 文生视频 / 图生视频 | 图片、视频、音频参考 | `default`, `svip`, `vip`, `xxl` | 30: 即梦人脸 |
| `seedance-2-fast` | 文生视频 / 图生视频 | 图片、视频、音频参考 | `default`, `svip`, `vip`, `xxl` | 30: 即梦人脸 |
| `wan2.2-i2v-flash` | 图生视频 | 图片参考，最多 5 张 | `default`, `svip`, `vip`, `xxl` | 15: 阿里系-视频生成模型-normal |
| `wan2.2-kf2v-flash` | 首尾帧生视频 | 首帧 + 尾帧，最多 5 张 | `default`, `svip`, `vip`, `xxl` | 15: 阿里系-视频生成模型-normal |
| `wan2.2-t2v-plus` | 文生视频 | 无参考图 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.5-i2v-preview` | 图生视频 | 图片参考，最多 5 张；音频最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.5-t2v-preview` | 文生视频 | 可带音频，最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.6-i2v` | 图生视频 | 图片参考，最多 5 张；音频最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.6-r2v` | 参考视频/图像生视频 | 图片最多 5 张；视频参考最长 180 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.6-r2v-flash` | 参考视频/图像生视频 | 图片最多 5 张；视频参考最长 180 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.6-t2v` | 文生视频 | 可带音频，最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.7-i2v` | 图生视频 | 图片参考，最多 5 张；音频最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |
| `wan2.7-t2v` | 文生视频 | 可带音频，最长 600 秒 | `svip`, `vip`, `xxl` | 16: 阿里系-视频生成模型-vip |

注意：

- `default` 分组只可用 `seedance-2`、`seedance-2-fast`、`wan2.2-i2v-flash`、`wan2.2-kf2v-flash`。
- `doubao-seedance-2-0-260128` 只在 `xxl` 分组可用。
- Wan 系列多数 `max_video_seconds=15`，前端应把时长限制在 15 秒以内。
- `seedance-2-fast` 不支持 `1080p`，最高使用 `720p`。

## 3. 创建视频任务

推荐请求：

```http
POST /v1/videos
Content-Type: application/json
```

最小文生视频请求：

```json
{
  "model": "wan2.7-t2v",
  "prompt": "一只白色机械猫穿过未来城市街道",
  "duration": 5,
  "size": "1280x720"
}
```

最小图生视频请求：

```json
{
  "model": "wan2.7-i2v",
  "prompt": "让画面中的人物向镜头挥手，背景轻微运镜",
  "image": "https://example.com/first-frame.png",
  "duration": 5,
  "size": "720p"
}
```

首尾帧生视频请求：

```json
{
  "model": "wan2.2-kf2v-flash",
  "prompt": "从第一张图平滑过渡到第二张图，镜头缓慢推进",
  "images": [
    "https://example.com/first-frame.png",
    "https://example.com/last-frame.png"
  ],
  "duration": 5,
  "size": "720p"
}
```

通用字段：

| 字段 | 必填 | 类型 | 说明 |
|---|---:|---|---|
| `model` | 是 | string | 已激活视频模型名 |
| `prompt` | 是 | string | 视频提示词 |
| `image` | 否 | string | 单张参考图 URL 或 data URL |
| `images` | 否 | string[] | 多张参考图；首尾帧模型使用前两张 |
| `size` | 否 | string | 尺寸、宽高比或分辨率。Wan 文生视频可用 `1280*720`；通用前端可传 `1280x720`、`720p` |
| `duration` | 否 | number | 秒数；默认 5 |
| `seconds` | 否 | string | 旧字段，`duration` 缺失时使用 |
| `audio` | 否 | boolean | 是否生成或使用音频；Wan 部分模型支持 |
| `mode` | 否 | string | Seedance 多参考模式使用：`first_last_frame` / `multi_ref` |
| `metadata` | 否 | object | 透传 provider 参数 |

创建成功返回 OpenAI Video 风格对象：

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "wan2.7-t2v",
  "status": "queued",
  "progress": 0,
  "created_at": 1760000000
}
```

客户端只保存公开 `id` / `task_id`，不要依赖上游真实 task ID。网关会把上游 task ID 存在服务端 `private_data.upstream_task_id`。

## 4. 查询视频任务

推荐查询：

```http
GET /v1/videos/{task_id}
```

处理中：

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "wan2.7-t2v",
  "status": "in_progress",
  "progress": 35,
  "created_at": 1760000000
}
```

成功：

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "model": "wan2.7-t2v",
  "status": "completed",
  "progress": 100,
  "created_at": 1760000000,
  "completed_at": 1760000030,
  "metadata": {
    "url": "https://example.com/result.mp4"
  }
}
```

失败：

```json
{
  "id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "object": "video",
  "status": "failed",
  "progress": 100,
  "error": {
    "message": "provider error message",
    "code": "provider_error"
  }
}
```

状态枚举：

| 状态 | 含义 | 是否终态 |
|---|---|---:|
| `queued` | 已提交 / 排队中 | 否 |
| `in_progress` | 生成中 | 否 |
| `completed` | 已完成 | 是 |
| `failed` | 失败 | 是 |
| `unknown` | 未知状态 | 否 |

取视频 URL：

```ts
export function getVideoUrl(video: { metadata?: Record<string, unknown> }) {
  const url = video.metadata?.url;
  return typeof url === 'string' ? url : '';
}
```

## 5. 下载 / 播放视频内容

如果查询结果的 `metadata.url` 是远端 URL，客户端可以直接播放。

如果需要通过网关代理读取内容：

```http
GET /v1/videos/{task_id}/content
```

该接口要求任务已成功，否则会返回错误。

## 6. 项目兼容格式

如果使用旧接口：

```http
POST /v1/video/generations
GET  /v1/video/generations/{task_id}
```

提交成功仍会返回 OpenAI Video 风格对象。查询返回网关通用包装：

```json
{
  "code": "success",
  "message": "",
  "data": {
    "task_id": "task_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "platform": "17",
    "channel_id": 16,
    "action": "TEXT_GENERATE",
    "status": "SUCCESS",
    "progress": "100%",
    "result_url": "https://example.com/result.mp4",
    "properties": {},
    "data": {}
  }
}
```

旧接口状态是内部枚举：

| 内部状态 | OpenAI 兼容状态 |
|---|---|
| `SUBMITTED` | `queued` |
| `QUEUED` | `queued` |
| `IN_PROGRESS` | `in_progress` |
| `SUCCESS` | `completed` |
| `FAILURE` | `failed` |

前端新实现建议优先使用 `/v1/videos`，减少状态转换。

## 7. 模型路由建议

```ts
const ACTIVE_VIDEO_MODELS = [
  'doubao-seedance-2-0-260128',
  'kling/kling-v3-omni-video-generation',
  'seedance-2',
  'seedance-2-fast',
  'wan2.2-i2v-flash',
  'wan2.2-kf2v-flash',
  'wan2.2-t2v-plus',
  'wan2.5-i2v-preview',
  'wan2.5-t2v-preview',
  'wan2.6-i2v',
  'wan2.6-r2v',
  'wan2.6-r2v-flash',
  'wan2.6-t2v',
  'wan2.7-i2v',
  'wan2.7-t2v',
] as const;

const T2V_MODELS = new Set([
  'wan2.2-t2v-plus',
  'wan2.5-t2v-preview',
  'wan2.6-t2v',
  'wan2.7-t2v',
]);

const I2V_MODELS = new Set([
  'wan2.2-i2v-flash',
  'wan2.5-i2v-preview',
  'wan2.6-i2v',
  'wan2.7-i2v',
]);

const FIRST_LAST_FRAME_MODELS = new Set(['wan2.2-kf2v-flash']);

const REFERENCE_VIDEO_MODELS = new Set(['wan2.6-r2v', 'wan2.6-r2v-flash']);

const SEEDANCE_MODELS = new Set(['seedance-2', 'seedance-2-fast', 'doubao-seedance-2-0-260128']);

const KLING_MODELS = new Set(['kling/kling-v3-omni-video-generation']);
```

路由函数：

```ts
interface VideoRouteInput {
  model: string;
  imageCount: number;
  videoCount: number;
}

export function routeVideoRequest(input: VideoRouteInput) {
  if (!ACTIVE_VIDEO_MODELS.includes(input.model as any)) {
    throw new Error(`未激活的视频模型: ${input.model}`);
  }

  return {
    endpoint: '/v1/videos',
    method: 'POST' as const,
    bodyKind: 'json' as const,
  };
}
```

## 8. 前端校验规则

```ts
export function validateVideoRequest(input: {
  model: string;
  prompt: string;
  images?: string[];
  videoUrls?: string[];
  duration?: number;
  resolution?: string;
}) {
  if (!input.prompt.trim()) {
    throw new Error('请输入视频提示词');
  }

  if (input.model === 'seedance-2-fast' && input.resolution === '1080p') {
    throw new Error('seedance-2-fast 不支持 1080p');
  }

  if (input.duration && input.duration > 15) {
    throw new Error('当前激活视频模型最长生成 15 秒');
  }

  const imageCount = input.images?.length ?? 0;
  const videoCount = input.videoUrls?.length ?? 0;

  if (I2V_MODELS.has(input.model) && imageCount < 1) {
    throw new Error(`${input.model} 需要至少 1 张参考图`);
  }

  if (FIRST_LAST_FRAME_MODELS.has(input.model) && imageCount < 2) {
    throw new Error(`${input.model} 需要首帧和尾帧 2 张图`);
  }

  if (REFERENCE_VIDEO_MODELS.has(input.model) && imageCount + videoCount < 1) {
    throw new Error(`${input.model} 需要图片或视频参考`);
  }
}
```

## 9. 请求构造示例

```ts
interface CreateVideoTaskInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  images?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
  duration?: number;
  size?: string;
  mode?: string;
  metadata?: Record<string, unknown>;
}

export async function createVideoTask(input: CreateVideoTaskInput) {
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    duration: input.duration ?? 5,
    size: input.size ?? '1280x720',
  };

  if (input.images?.length === 1) {
    body.image = input.images[0];
  } else if (input.images?.length) {
    body.images = input.images;
  }

  const metadata = { ...(input.metadata ?? {}) };

  if (input.videoUrls?.length) {
    metadata.video_urls = input.videoUrls;
  }

  if (input.audioUrls?.length) {
    metadata.audio_urls = input.audioUrls;
  }

  if (input.mode) {
    body.mode = input.mode;
  }

  if (Object.keys(metadata).length > 0) {
    body.metadata = metadata;
  }

  const res = await fetch(`${input.baseUrl}/v1/videos`, {
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

  return (await res.json()) as {
    id: string;
    task_id?: string;
    object: 'video';
    model: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'unknown';
    progress: number;
    created_at: number;
  };
}
```

轮询：

```ts
export async function pollVideoTask(input: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  signal?: AbortSignal;
}) {
  const startedAt = Date.now();
  let interval = 2000;

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    const res = await fetch(`${input.baseUrl}/v1/videos/${input.taskId}`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
      signal: input.signal,
    });

    if (!res.ok) {
      throw await normalizeApiError(res);
    }

    const task = await res.json();

    if (task.status === 'completed') {
      return task;
    }

    if (task.status === 'failed') {
      throw new Error(task.error?.message ?? '视频生成失败');
    }

    await sleep(interval, input.signal);
    interval = Math.min(Math.floor(interval * 1.4), 10000);
  }

  throw new Error('视频生成超时');
}
```

## 10. 视频素材上传

视频生成接口不直接接收本地 `File` 作为任务输入。前端需要先把本地素材上传到网关，拿到可被上游模型访问的临时 URL，再把 URL 放进 `/v1/videos` 请求。

推荐流程：

1. 上传本地图片 / 视频 / 音频素材到素材库。
2. 从返回结果读取 `url`，这个字段是 OSS signed URL。
3. 创建视频任务时，把图片 URL 放到 `image` / `images`，把视频 URL 放到 `metadata.video_urls`，把音频 URL 放到 `metadata.audio_urls`。
4. 如果任务不是立即提交，提交前用素材库列表接口重新获取新的 `url`，避免 signed URL 过期。

### 10.1 推荐上传接口

```http
POST /api/user/media/library/upload
Content-Type: multipart/form-data
```

该接口走登录态鉴权，适合 `node-canvas-studio` 这类前端应用使用。

表单字段：

| 字段 | 必填 | 类型 | 说明 |
|---|---:|---|---|
| `file` | 是 | File / Blob | 本地素材文件 |
| `name` | 否 | string | 展示名称 |
| `tags` | 否 | string | JSON 数组字符串，或逗号分隔标签 |
| `duration` | 否 | number | 前端已解析到的视频 / 音频时长，秒 |
| `width` | 否 | number | 视频 / 图片宽度 |
| `height` | 否 | number | 视频 / 图片高度 |
| `fps` | 否 | number | 视频帧率 |
| `ext` | 否 | string | 文件扩展名 |

支持的素材类型：

| 类型 | 常见格式 | 说明 |
|---|---|---|
| 图片 | JPG、PNG、WEBP、GIF | WEBP / GIF 上传时后端会尽量转 JPEG，便于 Seedance 使用 |
| 视频 | MP4、M4V、WEBM、MOV | 用于参考视频、多模态视频输入 |
| 音频 | MP3、WAV、OGG、AAC、M4A | 用于 Seedance / Wan 支持音频输入的模型 |

单文件上限：200MiB。

上传示例：

```ts
interface UploadVideoMaterialInput {
  file: File;
  name?: string;
  tags?: string[];
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export async function uploadVideoMaterial(input: UploadVideoMaterialInput) {
  const form = new FormData();
  form.append('file', input.file);

  if (input.name) form.append('name', input.name);
  if (input.tags?.length) form.append('tags', JSON.stringify(input.tags));
  if (input.duration) form.append('duration', String(input.duration));
  if (input.width) form.append('width', String(input.width));
  if (input.height) form.append('height', String(input.height));
  if (input.fps) form.append('fps', String(input.fps));

  const res = await fetch('/api/user/media/library/upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw await normalizeApiError(res);
  }

  const body = await res.json();
  if (!body?.success) {
    throw new Error(body?.message ?? '素材上传失败');
  }

  return body.data as {
    id: string;
    name: string;
    media_type: 'image' | 'video' | 'audio';
    content_type: string;
    size_bytes: number;
    object_key: string;
    url: string;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    seedance_official_id?: string;
    seedance_group_id?: string;
    seedance_status?: string;
  };
}
```

返回示例：

```json
{
  "success": true,
  "data": {
    "id": "b04d6a9c-0000-0000-0000-000000000000",
    "name": "ref.mp4",
    "media_type": "video",
    "content_type": "video/mp4",
    "size_bytes": 1024000,
    "object_key": "user-media/123/20260517/xxxx.mp4",
    "url": "https://bucket.oss-cn-hangzhou.aliyuncs.com/user-media/123/20260517/xxxx.mp4?...",
    "duration": 8,
    "width": 1280,
    "height": 720,
    "fps": 30
  }
}
```

### 10.2 素材列表与刷新 URL

素材库列表：

```http
GET /api/user/media/library?type=video&page=1&page_size=20
```

可选 `type`：

- `image`
- `video`
- `audio`

返回的每个素材同样包含 `url`。该 `url` 是临时 signed URL，前端提交任务时应使用最新列表返回的 URL。

如果只保存了普通 OSS 上传的 `object_key`，可以用签名接口刷新 URL：

```http
POST /api/user/media/oss/sign
Content-Type: application/json

{
  "object_key": "user-media/123/20260517/xxxx.mp4"
}
```

返回：

```json
{
  "success": true,
  "data": {
    "signed_url": "https://bucket.oss-cn-hangzhou.aliyuncs.com/user-media/123/20260517/xxxx.mp4?...",
    "expires_in": 86400
  }
}
```

### 10.3 创建任务时使用上传素材

图生视频：

```ts
const imageMaterial = await uploadVideoMaterial({ file: imageFile });

const task = await createVideoTask({
  baseUrl,
  apiKey,
  model: 'wan2.7-i2v',
  prompt: '让图片中的人物向镜头挥手',
  images: [imageMaterial.url],
  duration: 5,
  size: '720p',
});
```

参考视频生成：

```ts
const videoMaterial = await uploadVideoMaterial({ file: videoFile });

const task = await createVideoTask({
  baseUrl,
  apiKey,
  model: 'wan2.6-r2v',
  prompt: '参考视频的动作节奏，生成同风格新片段',
  videoUrls: [videoMaterial.url],
  duration: 5,
  size: '720p',
});
```

带音频参考：

```ts
const imageMaterial = await uploadVideoMaterial({ file: imageFile });
const audioMaterial = await uploadVideoMaterial({ file: audioFile });

const task = await createVideoTask({
  baseUrl,
  apiKey,
  model: 'seedance-2',
  prompt: '根据参考图生成口播短视频，使用参考音频风格',
  images: [imageMaterial.url],
  audioUrls: [audioMaterial.url],
  duration: 5,
  size: '720p',
  metadata: {
    generate_audio: true,
  },
});
```

### 10.4 不推荐直接用通用 OSS 上传

还有一个轻量上传接口：

```http
POST /api/user/media/oss/upload
Content-Type: multipart/form-data
```

它返回 `object_key` 和 `signed_url`，但单文件上限是 20MiB，且只覆盖图片 / 视频，不覆盖音频。视频素材库建议统一使用 `/api/user/media/library/upload`。

### 10.5 Seedance 官方素材库

当前还有 Seedance 官方素材代理接口：

```http
POST /v1/seedance/assets
GET  /v1/seedance/assets
```

这类接口要求传 `X-Channel-Id` 或 `channel_id` 指向 Seedance 渠道，更适合管理后台或平台侧工具。普通前端生成链路不需要直接调用它。

素材库中图片可以通过以下接口同步到 Seedance 官方素材库：

```http
POST /api/user/media/library/{id}/seedance-sync
```

限制：

- 只支持图片素材。
- Seedance 官方素材库只接受 JPEG / PNG。
- 同步成功后素材会有 `seedance_official_id`、`seedance_group_id`、`seedance_status`。

## 11. Provider 特殊说明

### 11.1 Wan / 阿里视频

激活模型：

- `wan2.2-i2v-flash`
- `wan2.2-kf2v-flash`
- `wan2.2-t2v-plus`
- `wan2.5-i2v-preview`
- `wan2.5-t2v-preview`
- `wan2.6-i2v`
- `wan2.6-r2v`
- `wan2.6-r2v-flash`
- `wan2.6-t2v`
- `wan2.7-i2v`
- `wan2.7-t2v`

前端可以提交通用 flat 结构，网关会转换为阿里原生：

- `image` / `images[0]` -> `input.img_url`
- `wan2.2-kf2v-flash` 的 `images[0]` -> `first_frame_url`，`images[1]` -> `last_frame_url`
- `duration` / `seconds` -> `parameters.duration`
- `size` 是 `1280*720` 这类格式时 -> `parameters.size`
- `size` 是 `720p` / `1080p` 时 -> `parameters.resolution`
- `metadata` 可覆盖或补充 `input` / `parameters`

### 11.2 Seedance

激活模型：

- `seedance-2`
- `seedance-2-fast`
- `doubao-seedance-2-0-260128`

模式自动推断：

- 0 张图片 -> `text_to_video`
- 1 张图片 -> `image_to_video`
- 2 张及以上图片且 `mode=first_last_frame` -> 首尾帧
- 多图 / 视频 / 音频参考 -> `multi_ref`

可通过 `metadata` 传：

```json
{
  "metadata": {
    "resolution": "720p",
    "ratio": "16:9",
    "generate_audio": true,
    "video_urls": ["https://example.com/ref.mp4"],
    "audio_urls": ["https://example.com/ref.mp3"],
    "video_ref_duration": 8
  }
}
```

### 11.3 Kling Omni

激活模型：

- `kling/kling-v3-omni-video-generation`

支持通用 flat 结构：

- `image` -> 首帧
- `images[1]` -> 尾帧
- `size` -> `aspect_ratio`
- `duration` -> 字符串秒数
- `metadata` 可覆盖 `mode`、`cfg_scale`、`camera_control`、`static_mask`、`dynamic_masks`

## 12. 建议 UI 显示

模型选择时按能力分组：

- 文生视频：`wan2.2-t2v-plus`、`wan2.5-t2v-preview`、`wan2.6-t2v`、`wan2.7-t2v`、`seedance-2`、`seedance-2-fast`
- 图生视频：`wan2.2-i2v-flash`、`wan2.5-i2v-preview`、`wan2.6-i2v`、`wan2.7-i2v`
- 首尾帧：`wan2.2-kf2v-flash`
- 参考视频：`wan2.6-r2v`、`wan2.6-r2v-flash`
- 多模态视频：`doubao-seedance-2-0-260128`、`kling/kling-v3-omni-video-generation`

根据用户分组过滤：

- `default`：只展示 `seedance-2`、`seedance-2-fast`、`wan2.2-i2v-flash`、`wan2.2-kf2v-flash`
- `svip` / `vip`：展示除 `doubao-seedance-2-0-260128` 外的模型
- `xxl`：展示全部模型
