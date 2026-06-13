import type { ModelDef } from '@/types/model';
import { request } from './client';
import { routeRequest, type RouteCtx, type TaskInput } from './model-routing';
import { pollTask } from './poll';
import { resolveTemplate, type Vars } from './template';
import { apiUrl } from './url';

export interface ImageGenResult {
  created?: number;
  data: Array<{ url?: string; b64_json?: string }>;
}

interface AsyncInit {
  task_id?: string;
  id?: string;
  status?: string;
}

export interface GenerateImageOpts {
  model: ModelDef;
  baseUrl: string;
  apiKey?: string;
  vars: Vars;
  ctx: RouteCtx;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const TASK: TaskInput = { type: 'image' };

export async function generateImage(opts: GenerateImageOpts): Promise<ImageGenResult> {
  const route = routeRequest(TASK, opts.model, opts.ctx);
  const resolved = resolveTemplate(route.bodyTemplate, opts.vars);
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  const url = apiUrl(baseUrl, route.endpoint);
  const body: BodyInit =
    resolved.kind === 'json' ? JSON.stringify(resolved.body) : resolved.body;

  if (route.async) {
    const init = await request<AsyncInit>({
      url,
      method: 'POST',
      apiKey: opts.apiKey,
      body,
      bodyKind: resolved.kind,
      signal: opts.signal,
      timeoutMs: opts.timeoutMs,
    });
    const taskId = init.task_id ?? init.id;
    if (!taskId) throw new Error('Async image response missing task_id');
    const pollUrl = apiUrl(baseUrl, `/v1/tasks/${taskId}`);
    return pollTask<ImageGenResult & AsyncInit>(pollUrl, {
      apiKey: opts.apiKey,
      signal: opts.signal,
      isDone: (r) => {
        if (r.status === 'completed') return 'completed';
        if (r.status === 'failed') return 'failed';
        return 'pending';
      },
    });
  }

  return request<ImageGenResult>({
    url,
    method: 'POST',
    apiKey: opts.apiKey,
    body,
    bodyKind: resolved.kind,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  });
}
