import type { ModelDef } from '@/types/model';
import { request } from './client';
import { routeRequest, rewriteSoraPrompt, type RouteCtx, type TaskInput } from './model-routing';
import { pollTask } from './poll';
import { resolveTemplate, type Vars } from './template';
import { apiUrl } from './url';

export interface VideoGenResult {
  created?: number;
  data?: Array<{ url?: string }> | {
    status?: string;
    result_url?: string;
    url?: string;
    video_url?: string;
    output_url?: string;
    error_msg?: string;
    message?: string;
  };
  metadata?: {
    url?: unknown;
    result_url?: unknown;
    video_url?: unknown;
    output_url?: unknown;
    remote_url?: unknown;
    [key: string]: unknown;
  };
  status?: string;
  id?: string;
  task_id?: string;
  error?: { message?: string };
}

export interface GenerateVideoOpts {
  model: ModelDef;
  baseUrl: string;
  apiKey?: string;
  vars: Vars;
  ctx: RouteCtx;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const TASK: TaskInput = { type: 'video' };

export interface BuiltVideoRequest {
  endpoint: string;
  body: Record<string, unknown>;
  bodyKind: 'json';
  async: boolean;
}

export function buildVideoRequest(opts: GenerateVideoOpts): BuiltVideoRequest {
  const route = routeRequest(TASK, opts.model, opts.ctx);

  const vars: Vars = { ...opts.vars };
  if (opts.model.name.toLowerCase().includes('sora') && typeof vars.prompt === 'string') {
    vars.prompt = rewriteSoraPrompt(vars.prompt);
  }

  const resolved = resolveTemplate(route.bodyTemplate, vars);
  if (resolved.kind !== 'json') {
    throw new Error('Video generation only supports JSON requests');
  }
  return {
    endpoint: route.endpoint,
    body: resolved.body,
    bodyKind: 'json',
    async: route.async,
  };
}

export async function generateVideo(opts: GenerateVideoOpts): Promise<VideoGenResult> {
  const built = buildVideoRequest(opts);
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  const url = apiUrl(baseUrl, built.endpoint);
  const body = JSON.stringify(built.body);

  if (built.async) {
    const init = await request<VideoGenResult>({
      url,
      method: 'POST',
      apiKey: opts.apiKey,
      body,
      bodyKind: built.bodyKind,
      signal: opts.signal,
      timeoutMs: opts.timeoutMs,
    });
    const taskId = init.task_id ?? init.id;
    if (!taskId) throw new Error('Async video response missing task_id');
    const pollUrl =
      built.endpoint === '/v1/video/generations'
        ? apiUrl(baseUrl, `/v1/video/generations/${taskId}`)
        : apiUrl(baseUrl, `/v1/tasks/${taskId}`);
    return pollTask<VideoGenResult>(pollUrl, {
      apiKey: opts.apiKey,
      signal: opts.signal,
      isDone: (r) => {
        if (r.status === 'completed') return 'completed';
        if (r.status === 'failed') return 'failed';
        const compatStatus = !Array.isArray(r.data) ? r.data?.status : undefined;
        if (compatStatus === 'SUCCESS') return 'completed';
        if (compatStatus === 'FAILURE') return 'failed';
        return 'pending';
      },
    });
  }

  return request<VideoGenResult>({
    url,
    method: 'POST',
    apiKey: opts.apiKey,
    body,
    bodyKind: built.bodyKind,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  });
}

export function videoResultToUrl(result: VideoGenResult): string | undefined {
  const metadataUrl =
    firstString(
      result.metadata?.url,
      result.metadata?.result_url,
      result.metadata?.video_url,
      result.metadata?.output_url,
      result.metadata?.remote_url,
    );
  if (metadataUrl) return metadataUrl;
  if (Array.isArray(result.data)) return result.data.find((item) => item.url)?.url;
  return firstString(
    result.data?.result_url,
    result.data?.url,
    result.data?.video_url,
    result.data?.output_url,
  );
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}
