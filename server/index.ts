import { createHmac, createHash, randomUUID } from 'node:crypto';
import { loadStorageConfig, getPublicStorageStatus, type StorageConfig } from './config';
import { handleVideoTaskRequest, initVideoTasks } from './video-tasks';

const PORT = Number(Bun.env.PORT || 80);
const DIST_DIR = new URL('../dist/', import.meta.url);

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

await initVideoTasks();

type BunServeOptions = Parameters<typeof Bun.serve>[0] & { maxRequestBodySize?: number };

const serverOptions = {
  port: PORT,
  maxRequestBodySize: 1024 * 1024 * 1024,
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/healthz') {
      return text('ok\n');
    }

    if (url.pathname === '/api/storage/status') {
      return json(getPublicStorageStatus());
    }

    if (url.pathname === '/api/video/tasks' || url.pathname.startsWith('/api/video/tasks/')) {
      try {
        return await handleVideoTaskRequest(request, url);
      } catch (err) {
        return json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 400 },
        );
      }
    }

    if (
      (url.pathname === '/api/user/media/library/upload' ||
        url.pathname === '/api/user/media/library/upload-proxy') &&
      request.method === 'POST'
    ) {
      try {
        return url.pathname.endsWith('/upload-proxy')
          ? await handleMediaUploadProxy(request)
          : await handleMediaUpload(request);
      } catch (err) {
        console.error('media upload failed:', err);
        return json(
          { success: false, message: err instanceof Error ? err.message : String(err) },
          { status: 500 },
        );
      }
    }

    if (url.pathname === '/api/user/media/library/import-url' && request.method === 'POST') {
      return handleMediaImportUrl(request);
    }

    if (
      url.pathname === '/api/user/media/library/blob' &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      return handleMediaBlob(url);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found' }, { status: 404 });
    }

    return serveStatic(url.pathname);
  },
};

const server = Bun.serve(serverOptions as BunServeOptions) as { port: number };

console.log(`node-canvas-studio listening on :${server.port}`);

async function serveStatic(pathname: string): Promise<Response> {
  const safePath = normalizeStaticPath(pathname);
  const file = Bun.file(new URL(safePath, DIST_DIR));

  if (await file.exists()) {
    return new Response(file, {
      headers: staticHeaders(safePath),
    });
  }

  const index = Bun.file(new URL('index.html', DIST_DIR));
  return new Response(index, {
    headers: { 'Content-Type': MIME_TYPES['.html'] },
  });
}

function normalizeStaticPath(pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const clean = decoded.replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return 'index.html';
  return clean.endsWith('/') ? `${clean}index.html` : clean;
}

function staticHeaders(pathname: string): Record<string, string> {
  const ext = getExtension(pathname);
  const headers: Record<string, string> = {
    'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
  };

  if (isImmutableAsset(pathname)) {
    headers['Cache-Control'] = 'public, max-age=604800, immutable';
  }

  return headers;
}

function getExtension(pathname: string): string {
  const index = pathname.lastIndexOf('.');
  return index >= 0 ? pathname.slice(index).toLowerCase() : '';
}

function isImmutableAsset(pathname: string): boolean {
  return pathname.startsWith('assets/');
}

function text(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...init?.headers,
    },
  });
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...init?.headers,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, New-Api-User, X-Media-Base-Url, X-Media-Access-Token, X-Media-User',
  };
}

async function handleMediaUpload(request: Request): Promise<Response> {
  const config = loadStorageConfig();
  if (!config) {
    return json({ success: false, message: 'storage_not_configured' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return json({ success: false, message: 'missing file' }, { status: 400 });
  }

  const name = String(form.get('name') || getBlobName(file) || 'upload.bin');
  const key = makeObjectKey(name);
  await putTosObject(config, key, file);

  const url = `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  return json({
    success: true,
    data: {
      id: key,
      name,
      media_type: getMediaType(file.type),
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      object_key: key,
      url,
    },
  });
}

async function handleMediaImportUrl(request: Request): Promise<Response> {
  const config = loadStorageConfig();
  if (!config) {
    return json({ success: false, message: 'storage_not_configured' }, { status: 503 });
  }

  let payload: { url?: unknown; name?: unknown };
  try {
    payload = (await request.json()) as { url?: unknown; name?: unknown };
  } catch {
    return json({ success: false, message: 'invalid json' }, { status: 400 });
  }

  if (typeof payload.url !== 'string' || !isImportableUrl(payload.url)) {
    return json({ success: false, message: 'invalid url' }, { status: 400 });
  }

  if (isStoredPublicUrl(config, payload.url)) {
    return json({
      success: true,
      data: {
        url: payload.url,
      },
    });
  }

  const source = await fetchRemoteMedia(payload.url);
  if (!source.response.ok) {
    return json(
      { success: false, message: `source fetch failed: HTTP ${source.response.status}` },
      { status: 502 },
    );
  }

  const contentType = source.contentType;
  const body = source.body;
  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : getNameFromUrl(payload.url, contentType);
  const key = makeObjectKey(ensureExtension(name, contentType));
  await putTosObject(config, key, new Blob([body], { type: contentType }));

  const url = `${config.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  return json({
    success: true,
    data: {
      id: key,
      name,
      media_type: getMediaType(contentType),
      content_type: contentType,
      size_bytes: body.byteLength,
      object_key: key,
      url,
    },
  });
}

async function handleMediaBlob(url: URL): Promise<Response> {
  const sourceUrl = url.searchParams.get('url');
  if (!sourceUrl || !isImportableUrl(sourceUrl)) {
    return json({ success: false, message: 'invalid url' }, { status: 400 });
  }

  const source = await fetchRemoteMedia(sourceUrl);
  if (!source.response.ok) {
    return json(
      { success: false, message: `source fetch failed: HTTP ${source.response.status}` },
      { status: 502 },
    );
  }

  return new Response(source.body, {
    headers: {
      'Content-Type': source.contentType,
      'Cache-Control': 'no-store',
      ...corsHeaders(),
    },
  });
}

async function handleMediaUploadProxy(request: Request): Promise<Response> {
  const baseUrl = request.headers.get('x-media-base-url')?.trim().replace(/\/+$/, '');
  const accessToken = request.headers.get('x-media-access-token')?.trim();
  const userId = request.headers.get('x-media-user')?.trim();
  if (!baseUrl || !isImportableUrl(baseUrl)) {
    return json({ success: false, message: 'missing media proxy target' }, { status: 400 });
  }
  if (!accessToken || !userId) {
    return json(
      { success: false, message: 'missing user media auth; please open canvas from new-api' },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return json({ success: false, message: 'missing file' }, { status: 400 });
  }

  const name = String(form.get('name') || getBlobName(file) || 'upload.bin');
  const forward = new FormData();
  forward.append('file', file, name);
  forward.append('name', name);

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (userId) headers['New-Api-User'] = userId;
  const response = await fetch(`${baseUrl}/api/user/media/library/upload`, {
    method: 'POST',
    headers,
    body: forward,
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

async function fetchRemoteMedia(url: string): Promise<{
  response: Response;
  body: ArrayBuffer;
  contentType: string;
}> {
  const response = await fetch(url);
  return {
    response,
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

async function putTosObject(config: StorageConfig, key: string, blob: Blob): Promise<void> {
  const endpoint = new URL(config.endpoint);
  const host = `${config.bucket}.${endpoint.host}`;
  const objectUrl = `${endpoint.protocol}//${host}/${key}`;
  const body = await blob.arrayBuffer();
  const contentType = blob.type || 'application/octet-stream';
  const headers = signTosPut({
    config,
    key,
    body,
    contentType,
    host,
  });

  const res = await fetch(objectUrl, {
    method: 'PUT',
    headers,
    body,
  });
  if (!res.ok) {
    throw new Error(`TOS upload failed: HTTP ${res.status} ${await res.text()}`);
  }
}

function signTosPut(input: {
  config: StorageConfig;
  key: string;
  body: ArrayBuffer;
  contentType: string;
  host: string;
}): Record<string, string> {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const date = amzDate.slice(0, 8);
  const service = 's3';
  const region = input.config.region;
  const payloadHash = sha256Hex(input.body);
  const canonicalUri = `/${encodePath(input.key)}`;
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `content-type:${input.contentType}\n` +
    `host:${input.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signingKey = getSigningKey(input.config.secretAccessKey, date, region, service);
  const signature = hmacHex(signingKey, stringToSign);

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': input.contentType,
    Host: input.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
}

function makeObjectKey(name: string): string {
  const ext = getSafeExtension(name);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `node-canvas-studio/${day}/${randomUUID()}${ext}`;
}

function getBlobName(blob: Blob): string | null {
  const maybeFile = blob as unknown as { name?: unknown };
  return typeof maybeFile.name === 'string' ? maybeFile.name : null;
}

function getSafeExtension(name: string): string {
  const match = name.toLowerCase().match(/\.[a-z0-9]{1,8}$/);
  return match?.[0] ?? '';
}

function ensureExtension(name: string, contentType: string): string {
  if (getSafeExtension(name)) return name;
  return `${name}${extensionFromContentType(contentType)}`;
}

function extensionFromContentType(contentType: string): string {
  const type = contentType.toLowerCase().split(';')[0].trim();
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/gif') return '.gif';
  if (type === 'audio/mpeg') return '.mp3';
  if (type === 'audio/wav' || type === 'audio/wave' || type === 'audio/x-wav') return '.wav';
  if (type === 'audio/ogg') return '.ogg';
  if (type === 'audio/aac') return '.aac';
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return '.m4a';
  if (type === 'video/mp4') return '.mp4';
  if (type === 'video/webm') return '.webm';
  return '.bin';
}

function getNameFromUrl(value: string, contentType: string): string {
  const pathname = new URL(value).pathname;
  const filename = pathname.split('/').filter(Boolean).pop() || 'imported-media';
  return ensureExtension(filename, contentType);
}

function isImportableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isStoredPublicUrl(config: StorageConfig, value: string): boolean {
  return value.startsWith(`${config.publicBaseUrl.replace(/\/+$/, '')}/`);
}

function getMediaType(contentType: string): 'image' | 'video' | 'audio' {
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'image';
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, percentEncode))
    .join('/');
}

function percentEncode(char: string): string {
  return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value: string | ArrayBuffer): string {
  return createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value)).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function getSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}
