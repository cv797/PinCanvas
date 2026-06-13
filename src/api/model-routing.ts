import type { ModelDef, Modality, Provider } from '@/types/model';
import { getAllParameterValues } from '@/utils/modelParams';

export interface TaskInput {
  type: Modality;
}

export interface RouteCtx {
  hasReferenceImages: boolean;
  hasMask: boolean;
  useJimengLocalFile: boolean;
}

export interface RouteResult {
  endpoint: string;
  method: 'POST';
  bodyKind: 'json' | 'form';
  async: boolean;
  provider: Provider;
  /** 请求体模板（含 {{var:format}} 占位符），交给 resolveTemplate 处理。 */
  bodyTemplate: Record<string, unknown>;
}

/**
 * 任务 → endpoint 决策。规则与优先级见 docs/model-routing.md §1。
 * 优先级：MJ(6) → async-banana-2(3) → Jimeng-local(7) → sync edit(2) → GPT image(4) → flux(5) → generations(1)
 */
export function routeRequest(task: TaskInput, model: ModelDef, ctx: RouteCtx): RouteResult {
  const baseResult = (() => {
    if (task.type === 'chat') return routeChat(model);
    if (task.type === 'video') return routeVideo(model);
    return routeImage(model, ctx);
  })();

  if (model.parameters && model.parameters.length > 0) {
    const paramValues = getAllParameterValues(model.id, model.parameters);
    baseResult.bodyTemplate = mergeModelParameters(baseResult.bodyTemplate, paramValues);
  }

  return baseResult;
}

function mergeModelParameters(
  bodyTemplate: Record<string, unknown>,
  paramValues: Record<string, string | number | boolean>,
): Record<string, unknown> {
  const merged = { ...bodyTemplate };
  for (const [key, value] of Object.entries(paramValues)) {
    if (!(key in merged)) merged[key] = value;
  }
  return merged;
}

function routeChat(model: ModelDef): RouteResult {
  return {
    endpoint: '/v1/chat/completions',
    method: 'POST',
    bodyKind: 'json',
    async: false,
    provider: model.provider,
    bodyTemplate: {
      model: '{{modelName}}',
      messages: '{{messages}}',
    },
  };
}

function routeVideo(model: ModelDef): RouteResult {
  return {
    endpoint: '/v1/video/generations',
    method: 'POST',
    bodyKind: 'json',
    async: model.async ?? true,
    provider: model.provider,
    bodyTemplate: videoTemplate(),
  };
}

function routeImage(model: ModelDef, ctx: RouteCtx): RouteResult {
  const name = [model.id, model.name, model.displayName, model.group]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hasRef = ctx.hasReferenceImages;

  // 6: Midjourney
  if (model.provider === 'midjourney' || name.includes('midjourney') || name.startsWith('mj')) {
    return {
      endpoint: '/mj/submit/imagine',
      method: 'POST',
      bodyKind: 'json',
      async: true,
      provider: 'midjourney',
      bodyTemplate: { prompt: '{{prompt}}', model: '{{modelName}}' },
    };
  }

  // 3: 异步图生图（nano-banana-2）
  if (hasRef && name.includes('nano-banana-2')) {
    return {
      endpoint: '/v1/images/edits?async=true',
      method: 'POST',
      bodyKind: 'form',
      async: true,
      provider: model.provider,
      bodyTemplate: editsTemplate(ctx),
    };
  }

  // 7: Jimeng + 强制本地文件
  if (hasRef && model.provider === 'jimeng' && ctx.useJimengLocalFile) {
    return {
      endpoint: '/v1/images/edits',
      method: 'POST',
      bodyKind: 'form',
      async: false,
      provider: model.provider,
      bodyTemplate: editsTemplate(ctx),
    };
  }

  // 2: 同步图生图（multipart edits，排除后续 JSON 带图模型）
  const isEditCapable =
    ((model.supportsEdit &&
      !name.includes('gpt-image') &&
      !name.includes('gpt-4o-image') &&
      !name.includes('flux')) ||
      name.includes('banana') ||
      name.includes('edit') ||
      name.includes('qwen')) &&
    !name.includes('nano-banana-2');
  if (hasRef && isEditCapable) {
    return {
      endpoint: '/v1/images/edits',
      method: 'POST',
      bodyKind: 'form',
      async: false,
      provider: model.provider,
      bodyTemplate: editsTemplate(ctx),
    };
  }

  // Wan 图生图直接传可访问图片 URL，避免前端/后端下载再 multipart 上传。
  if (hasRef && name.includes('wan')) {
    return {
      endpoint: '/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      async: false,
      provider: model.provider,
      bodyTemplate: imageUrlTemplate(true),
    };
  }

  // 4: GPT image。带参考图时走 edits，避免源图只作为普通 JSON 字段被网关忽略。
  if (name.includes('gpt-image') || name.includes('gpt-4o-image')) {
    if (hasRef) {
      return {
        endpoint: '/v1/images/edits',
        method: 'POST',
        bodyKind: 'form',
        async: false,
        provider: model.provider,
        bodyTemplate: editsTemplate(ctx),
      };
    }
    return {
      endpoint: '/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      async: false,
      provider: model.provider,
      bodyTemplate: gptImageTemplate(hasRef),
    };
  }

  // 5: flux（含 kontext 支持 image 字段）
  if (name.includes('flux')) {
    return {
      endpoint: '/v1/images/generations',
      method: 'POST',
      bodyKind: 'json',
      async: false,
      provider: model.provider,
      bodyTemplate: fluxTemplate(hasRef),
    };
  }

  if (hasRef) {
    return {
      endpoint: '/v1/images/edits',
      method: 'POST',
      bodyKind: 'form',
      async: false,
      provider: model.provider,
      bodyTemplate: editsTemplate(ctx),
    };
  }

  // 1: 默认文生图
  return {
    endpoint: '/v1/images/generations',
    method: 'POST',
    bodyKind: 'json',
    async: false,
    provider: model.provider,
    bodyTemplate: generationsTemplate(),
  };
}

function generationsTemplate(): Record<string, unknown> {
  return {
    model: '{{modelName}}',
    prompt: '{{prompt}}',
    n: '{{n:number}}',
    size: '{{size:optional}}',
    enable_sequential: '{{enableSequential}}',
    enableSequential: '{{enableSequential}}',
    response_format: 'url',
  };
}

function editsTemplate(ctx: RouteCtx): Record<string, unknown> {
  const t: Record<string, unknown> = {
    model: '{{modelName}}',
    prompt: '{{prompt}}',
    image: '{{image:blob}}',
    n: '{{n:number}}',
    size: '{{size:optional}}',
    aspect_ratio: '{{ratio}}',
    image_size: '{{size}}',
    enable_sequential: '{{enableSequential}}',
    enableSequential: '{{enableSequential}}',
    response_format: 'url',
  };
  if (ctx.hasMask) t.mask = '{{mask:blob}}';
  return t;
}

function imageUrlTemplate(hasRef: boolean): Record<string, unknown> {
  const t: Record<string, unknown> = {
    model: '{{modelName}}',
    prompt: '{{prompt}}',
    n: '{{n:number}}',
    size: '{{size:optional}}',
    enable_sequential: '{{enableSequential}}',
    enableSequential: '{{enableSequential}}',
    response_format: 'url',
  };
  if (hasRef) t.image = '{{imageUrls}}';
  return t;
}

function fluxTemplate(hasRef: boolean): Record<string, unknown> {
  return imageUrlTemplate(hasRef);
}

function gptImageTemplate(hasRef: boolean): Record<string, unknown> {
  const t = imageUrlTemplate(hasRef);
  return {
    ...t,
    model: '{{modelName}}',
    prompt: '{{prompt}}',
    n: '{{n:number}}',
    size: '{{size}}',
    quality: '{{quality}}',
    enable_sequential: '{{enableSequential}}',
    enableSequential: '{{enableSequential}}',
    response_format: 'url',
  };
}

function videoTemplate(): Record<string, unknown> {
  return {
    model: '{{modelName}}',
    prompt: '{{prompt}}',
    mode: '{{mode:optional}}',
    duration: '{{duration:number}}',
    size: '{{size:optional}}',
    ratio: '{{ratio}}',
    resolution: '{{resolution}}',
    image: '{{primaryImageUrl:optional}}',
    images: '{{imageUrls:optional}}',
    input: '{{input:optional}}',
    parameters: '{{parameters:optional}}',
    metadata: '{{metadata:optional}}',
  };
}

/**
 * Sora 模型 prompt 里的 `@name` 改成 `@{name}`（角色占位符）。
 * lookahead `(?!\})` 防止 `@{hero}` 二次替换。
 */
export function rewriteSoraPrompt(prompt: string): string {
  return prompt.replace(/@([a-zA-Z0-9_-]+)(?!\})/g, '@{$1}');
}
