import { request } from './client';
import { getPref } from '@/store/prefs';

interface MediaUploadResponse {
  success?: boolean;
  message?: string;
  data?: {
    url?: string;
  };
}

interface MediaImportResponse extends MediaUploadResponse {}

interface MediaRequestOptions {
  apiKey?: string;
}

export async function uploadMaterial(
  blob: Blob,
  name: string,
  _opts: MediaRequestOptions = {},
): Promise<string> {
  const form = new FormData();
  form.append('file', blob, name);
  form.append('name', name);

  const result = await request<MediaUploadResponse>({
    url: mediaApiUrl('/api/user/media/library/upload'),
    method: 'POST',
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

function mediaApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const configured = import.meta.env.VITE_MEDIA_API_BASE_URL;
  if (configured) return `${String(configured).replace(/\/+$/, '')}${path}`;
  return path;
}

function mediaApiKey(opts: MediaRequestOptions = {}): string {
  if (opts.apiKey) return opts.apiKey;
  if (typeof window === 'undefined') return '';
  return getPref<string>('global_key', '');
}

export async function importImageUrlMaterial(
  url: string,
  name: string,
  _opts: MediaRequestOptions = {},
): Promise<string> {
  const result = await request<MediaImportResponse>({
    url: mediaApiUrl('/api/user/media/library/import-url'),
    method: 'POST',
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
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch(
    mediaApiUrl(`/api/user/media/library/blob?url=${encodeURIComponent(url)}`),
    Object.keys(headers).length > 0 ? { headers } : undefined,
  );
  if (!res.ok) throw new Error(`素材下载失败: HTTP ${res.status}`);
  return res.blob();
}
