import { request } from './client';
import { getPref } from '@/store/prefs';
import { FIXED_BASE_URL } from './upstream';

interface MediaUploadResponse {
  success?: boolean;
  message?: string;
  data?: {
    url?: string;
  };
}

interface MediaImportResponse extends MediaUploadResponse {}

interface MediaRequestOptions {
  baseUrl?: string;
  apiKey?: string;
}

interface MediaProxyTarget {
  baseUrl: string;
  accessToken?: string;
  userId?: string;
  hasUserAuth: boolean;
}

export async function uploadMaterial(
  blob: Blob,
  name: string,
  opts: MediaRequestOptions = {},
): Promise<string> {
  const form = new FormData();
  form.append('file', blob, name);
  form.append('name', name);

  const result = await request<MediaUploadResponse>({
    url: mediaUploadUrl(opts),
    method: 'POST',
    headers: mediaUploadHeaders(opts),
    body: form,
    bodyKind: 'form',
    timeoutMs: 10 * 60_000,
    maxRetries: 1,
  });

  if (result.success === false) throw new Error(result.message ?? '素材上传失败');
  const url = result.data?.url;
  if (!url) throw new Error('素材上传响应缺少 url');
  return url;
}

export async function uploadImageMaterial(
  blob: Blob,
  name: string,
  opts: MediaRequestOptions = {},
): Promise<string> {
  return uploadMaterial(blob, name, opts);
}

function mediaApiUrl(path: string, opts: MediaRequestOptions = {}): string {
  if (typeof window === 'undefined') return path;
  const configured = import.meta.env.VITE_MEDIA_API_BASE_URL;
  if (configured) return `${String(configured).replace(/\/+$/, '')}${path}`;
  const baseUrl = opts.baseUrl || getPref<string>('global_base_url', FIXED_BASE_URL);
  if (baseUrl) return `${baseUrl.replace(/\/+$/, '')}${path}`;
  if (window.location.port === '5173') return `http://127.0.0.1:8787${path}`;
  return path;
}

function mediaUploadUrl(opts: MediaRequestOptions = {}): string {
  if (typeof window === 'undefined') return mediaApiUrl('/api/user/media/library/upload', opts);
  const configured = import.meta.env.VITE_MEDIA_API_BASE_URL;
  if (configured) return `${String(configured).replace(/\/+$/, '')}/api/user/media/library/upload`;
  if (isDevMediaProxyAvailable() && resolveMediaProxyTarget(opts)?.hasUserAuth) {
    return '/api/user/media/library/upload-proxy';
  }
  return mediaApiUrl('/api/user/media/library/upload', opts);
}

function mediaProxyHeaders(opts: MediaRequestOptions = {}): Record<string, string> | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!isDevMediaProxyAvailable()) return undefined;
  const target = resolveMediaProxyTarget(opts);
  if (!target?.hasUserAuth) return undefined;
  const headers: Record<string, string> = {
    'X-Media-Base-Url': target.baseUrl,
  };
  if (target.accessToken) headers['X-Media-Access-Token'] = target.accessToken;
  if (target.userId) headers['X-Media-User'] = target.userId;
  return headers;
}

function mediaUploadHeaders(opts: MediaRequestOptions = {}): Record<string, string> | undefined {
  const proxyHeaders = mediaProxyHeaders(opts);
  if (proxyHeaders) return proxyHeaders;
  const userHeaders = userMediaAuthHeaders();
  return Object.keys(userHeaders).length > 0 ? userHeaders : undefined;
}

function mediaApiKey(opts: MediaRequestOptions = {}): string {
  if (opts.apiKey) return opts.apiKey;
  if (typeof window === 'undefined') return '';
  return getPref<string>('global_key', '');
}

function isDevMediaProxyAvailable(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined';
}

function resolveMediaProxyTarget(opts: MediaRequestOptions = {}): MediaProxyTarget | null {
  if (typeof window === 'undefined') return null;
  const baseUrl = (opts.baseUrl || getPref<string>('global_base_url', FIXED_BASE_URL)).trim();
  if (!baseUrl) return null;
  const userAuth = resolveUserMediaAuth();
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    hasUserAuth: Boolean(userAuth.accessToken && userAuth.userId),
    ...userAuth,
  };
}

function userMediaAuthHeaders(): Record<string, string> {
  const auth = resolveUserMediaAuth();
  const headers: Record<string, string> = {};
  if (auth.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;
  if (auth.userId) headers['New-Api-User'] = auth.userId;
  return headers;
}

function resolveUserMediaAuth(): Pick<MediaProxyTarget, 'accessToken' | 'userId'> {
  if (typeof window === 'undefined') return {};
  const user = readStoredUser();
  const accessToken =
    stringValue(user?.token) ||
    getPref<string>('access_token', '') ||
    getPref<string>('user_access_token', '');
  const userId = stringValue(user?.id) || getPref<string>('user_id', '');
  return {
    ...(accessToken ? { accessToken } : {}),
    ...(userId ? { userId } : {}),
  };
}

function readStoredUser(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export async function importImageUrlMaterial(
  url: string,
  name: string,
  opts: MediaRequestOptions = {},
): Promise<string> {
  const result = await request<MediaImportResponse>({
    url: mediaApiUrl('/api/user/media/library/import-url', opts),
    method: 'POST',
    headers: userMediaAuthHeaders(),
    body: JSON.stringify({ url, name }),
    bodyKind: 'json',
    maxRetries: 1,
  });

  if (result.success === false) throw new Error(result.message ?? '素材导入失败');
  const storedUrl = result.data?.url;
  if (!storedUrl) throw new Error('素材导入响应缺少 url');
  return storedUrl;
}

export async function fetchImageMaterialBlob(
  url: string,
  opts: MediaRequestOptions = {},
): Promise<Blob> {
  const apiKey = mediaApiKey(opts);
  const headers = userMediaAuthHeaders();
  if (apiKey && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(
    mediaApiUrl(`/api/user/media/library/blob?url=${encodeURIComponent(url)}`, opts),
    Object.keys(headers).length > 0 ? { headers } : undefined,
  );
  if (!res.ok) throw new Error(`素材下载失败: HTTP ${res.status}`);
  return res.blob();
}
