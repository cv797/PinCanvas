import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type ServerVideoTaskStatus =
  | 'queued'
  | 'submitting'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'awaiting_auth';

interface SubmitVideoTaskPayload {
  clientId?: unknown;
  nodeId?: unknown;
  historyEntryId?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  endpoint?: unknown;
  body?: unknown;
  async?: unknown;
}

interface ResumeVideoTaskPayload {
  apiKey?: unknown;
}

export interface ServerVideoTask {
  id: string;
  clientId: string;
  nodeId: string;
  historyEntryId?: string;
  model: string;
  baseUrl: string;
  endpoint: string;
  body: Record<string, unknown>;
  async: boolean;
  status: ServerVideoTaskStatus;
  tokenHash: string;
  upstreamTaskId?: string;
  pollUrl?: string;
  resultUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface PersistedTasksFile {
  tasks: ServerVideoTask[];
}

const RUNTIME_DIR = process.env.TAPNOW_RUNTIME_DIR || join(process.cwd(), '.tapnow-runtime');
const TASKS_FILE = join(RUNTIME_DIR, 'video-tasks.json');
const POLL_INTERVAL_MS = 5_000;
const tokenCache = new Map<string, string>();
const tasks = new Map<string, ServerVideoTask>();
const active = new Set<string>();
let saveChain = Promise.resolve();

export async function initVideoTasks(): Promise<void> {
  await loadTasks();
  let changed = false;
  for (const task of tasks.values()) {
    if (isActiveStatus(task.status)) {
      task.status = 'awaiting_auth';
      task.updatedAt = Date.now();
      changed = true;
    }
  }
  if (changed) await saveTasks();
}

export async function handleVideoTaskRequest(request: Request, url: URL): Promise<Response> {
  if (url.pathname === '/api/video/tasks' && request.method === 'POST') {
    return handleSubmit(request);
  }
  if (url.pathname === '/api/video/tasks' && request.method === 'GET') {
    return handleList(url);
  }

  const match = url.pathname.match(/^\/api\/video\/tasks\/([^/]+)(?:\/auth)?$/);
  if (!match) return json({ error: 'not_found' }, { status: 404 });

  const id = decodeURIComponent(match[1]);
  if (url.pathname.endsWith('/auth') && request.method === 'POST') {
    return handleResume(id, request);
  }
  if (!url.pathname.endsWith('/auth') && request.method === 'GET') {
    const task = tasks.get(id);
    if (!task) return json({ error: 'not_found' }, { status: 404 });
    return json({ task: publicTask(task) });
  }
  return json({ error: 'method_not_allowed' }, { status: 405 });
}

async function handleSubmit(request: Request): Promise<Response> {
  const payload = (await readJson(request)) as SubmitVideoTaskPayload;
  const clientId = expectString(payload.clientId, 'clientId');
  const nodeId = expectString(payload.nodeId, 'nodeId');
  const model = expectString(payload.model, 'model');
  const baseUrl = normalizeBaseUrl(expectString(payload.baseUrl, 'baseUrl'));
  const apiKey = expectString(payload.apiKey, 'apiKey');
  const endpoint = normalizeEndpoint(expectString(payload.endpoint, 'endpoint'));
  const body = expectObject(payload.body, 'body');
  const tokenHash = hashToken(apiKey);
  tokenCache.set(tokenHash, apiKey);

  const task: ServerVideoTask = {
    id: `vt_${Date.now().toString(36)}_${randomUUID()}`,
    clientId,
    nodeId,
    historyEntryId:
      typeof payload.historyEntryId === 'string' && payload.historyEntryId
        ? payload.historyEntryId
        : undefined,
    model,
    baseUrl,
    endpoint,
    body,
    async: payload.async !== false,
    status: 'queued',
    tokenHash,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(task.id, task);
  await saveTasks();
  startTask(task.id);
  return json({ task: publicTask(task) });
}

async function handleList(url: URL): Promise<Response> {
  const clientId = url.searchParams.get('clientId');
  const rows = Array.from(tasks.values())
    .filter((task) => !clientId || task.clientId === clientId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return json({ tasks: rows.map(publicTask) });
}

async function handleResume(id: string, request: Request): Promise<Response> {
  const task = tasks.get(id);
  if (!task) return json({ error: 'not_found' }, { status: 404 });
  const payload = (await readJson(request)) as ResumeVideoTaskPayload;
  const apiKey = expectString(payload.apiKey, 'apiKey');
  const tokenHash = hashToken(apiKey);
  if (tokenHash !== task.tokenHash) {
    return json({ error: 'token_mismatch' }, { status: 403 });
  }
  tokenCache.set(task.tokenHash, apiKey);
  if (task.status === 'awaiting_auth') {
    task.status = task.upstreamTaskId ? 'polling' : 'queued';
    task.updatedAt = Date.now();
    await saveTasks();
    startTask(task.id);
  }
  return json({ task: publicTask(task) });
}

function startTask(id: string): void {
  if (active.has(id)) return;
  active.add(id);
  void runTask(id).finally(() => active.delete(id));
}

async function runTask(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task || isTerminalStatus(task.status)) return;
  const apiKey = tokenCache.get(task.tokenHash);
  if (!apiKey) {
    await updateTask(task, { status: 'awaiting_auth' });
    return;
  }

  if (!task.upstreamTaskId && task.status !== 'polling') {
    await submitUpstream(task, apiKey);
  }
  if (task.status === 'completed' || task.status === 'failed') return;
  if (task.async) await pollUpstream(task, apiKey);
}

async function submitUpstream(task: ServerVideoTask, apiKey: string): Promise<void> {
  await updateTask(task, { status: 'submitting' });
  try {
    const res = await fetch(apiUrl(task.baseUrl, task.endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task.body),
    });
    const body = await parseJsonResponse(res);
    if (!res.ok) throw new Error(extractError(body) || `HTTP ${res.status}`);

    if (!task.async) {
      const resultUrl = videoResultToUrl(body);
      if (!resultUrl) throw new Error('Video response missing result URL');
      await updateTask(task, {
        status: 'completed',
        resultUrl,
        completedAt: Date.now(),
      });
      return;
    }

    const upstreamTaskId = firstString(body.task_id, body.id);
    if (!upstreamTaskId) throw new Error('Async video response missing task_id');
    const pollUrl =
      task.endpoint === '/v1/video/generations'
        ? apiUrl(task.baseUrl, `/v1/video/generations/${encodeURIComponent(upstreamTaskId)}`)
        : apiUrl(task.baseUrl, `/v1/tasks/${encodeURIComponent(upstreamTaskId)}`);
    await updateTask(task, {
      status: 'polling',
      upstreamTaskId,
      pollUrl,
    });
  } catch (err) {
    await updateTask(task, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      completedAt: Date.now(),
    });
  }
}

async function pollUpstream(task: ServerVideoTask, apiKey: string): Promise<void> {
  while (!isTerminalStatus(task.status)) {
    if (!task.pollUrl) {
      await updateTask(task, { status: 'failed', error: 'missing poll url' });
      return;
    }
    await sleep(POLL_INTERVAL_MS);
    try {
      const res = await fetch(task.pollUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const body = await parseJsonResponse(res);
      if (!res.ok) throw new Error(extractError(body) || `HTTP ${res.status}`);
      const status = videoPollStatus(body);
      if (status === 'completed') {
        const resultUrl = videoResultToUrl(body);
        if (!resultUrl) throw new Error('Completed video task missing result URL');
        await updateTask(task, {
          status: 'completed',
          resultUrl,
          completedAt: Date.now(),
        });
        return;
      }
      if (status === 'failed') {
        await updateTask(task, {
          status: 'failed',
          error: extractError(body) || 'Task failed',
          completedAt: Date.now(),
        });
        return;
      }
      await updateTask(task, { status: 'polling' });
    } catch (err) {
      await updateTask(task, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        completedAt: Date.now(),
      });
      return;
    }
  }
}

async function updateTask(
  task: ServerVideoTask,
  patch: Partial<Omit<ServerVideoTask, 'id'>>,
): Promise<void> {
  Object.assign(task, patch, { updatedAt: Date.now() });
  tasks.set(task.id, task);
  await saveTasks();
}

async function loadTasks(): Promise<void> {
  try {
    const raw = await readFile(TASKS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedTasksFile;
    if (!Array.isArray(parsed.tasks)) return;
    for (const task of parsed.tasks) {
      tasks.set(task.id, task);
    }
  } catch {
    /* no persisted tasks yet */
  }
}

async function saveTasks(): Promise<void> {
  saveChain = saveChain.then(async () => {
    await mkdir(dirname(TASKS_FILE), { recursive: true });
    const body: PersistedTasksFile = { tasks: Array.from(tasks.values()) };
    await writeFile(TASKS_FILE, JSON.stringify(body, null, 2), 'utf8');
  });
  await saveChain;
}

function publicTask(task: ServerVideoTask): ServerVideoTask {
  return { ...task };
}

async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error('invalid json');
  }
}

function videoPollStatus(body: Record<string, unknown>): 'pending' | 'completed' | 'failed' {
  const status = String(body.status ?? '').toLowerCase();
  if (status === 'completed' || status === 'succeeded') return 'completed';
  if (status === 'failed' || status === 'failure') return 'failed';
  const data = body.data;
  if (data && !Array.isArray(data) && typeof data === 'object') {
    const compat = String((data as Record<string, unknown>).status ?? '').toUpperCase();
    if (compat === 'SUCCESS' || compat === 'SUCCEEDED' || compat === 'COMPLETED') {
      return 'completed';
    }
    if (compat === 'FAILURE' || compat === 'FAILED' || compat === 'FAIL') return 'failed';
  }
  return 'pending';
}

function videoResultToUrl(body: Record<string, unknown>): string | undefined {
  const metadata = asObject(body.metadata);
  const metadataUrl = firstString(
    metadata?.url,
    metadata?.result_url,
    metadata?.video_url,
    metadata?.output_url,
    metadata?.remote_url,
  );
  if (metadataUrl) return metadataUrl;
  const data = body.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const url = asObject(item)?.url;
      if (typeof url === 'string' && url) return url;
    }
  }
  const dataObject = asObject(data);
  return firstString(
    dataObject?.result_url,
    dataObject?.url,
    dataObject?.video_url,
    dataObject?.output_url,
  );
}

function extractError(body: Record<string, unknown>): string | undefined {
  const error = body.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message) return message;
  }
  const data = asObject(body.data);
  return firstString(body.message, data?.message, data?.error_msg, data?.fail_reason);
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

function expectString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} required`);
  return value.trim();
}

function expectObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} required`);
  }
  return value as Record<string, unknown>;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeEndpoint(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function apiUrl(baseUrl: string, endpoint: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (base.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    return base + endpoint.slice('/v1'.length);
  }
  return base + endpoint;
}

function hashToken(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function isActiveStatus(status: ServerVideoTaskStatus): boolean {
  return status === 'queued' || status === 'submitting' || status === 'polling';
}

function isTerminalStatus(status: ServerVideoTaskStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}
