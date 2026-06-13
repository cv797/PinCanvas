export type JsonSchema = {
  type: string;
  [key: string]: unknown;
};

type StructuredProxyInput = {
  apiKey?: string;
  baseUrl: string;
  instructions: string;
  inputText: string;
  model: string;
  schema: JsonSchema;
  schemaName: string;
  maxOutputTokens: number;
  timeoutMs: number;
  imageDataUrls?: string[];
  imageDetail?: 'auto' | 'low' | 'high' | 'original';
};

type StructuredRequestResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      endpoint: string;
      status: number | null;
      error: string;
      unsupportedEndpoint: boolean;
    };

type ResponsesApiSuccess = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

type ChatCompletionsApiSuccess = {
  choices?: Array<{
    text?: string;
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
          }>;
    };
  }>;
};

class UpstreamHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamHttpError';
  }
}

export async function handleStructuredRequest(
  request: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  let input: StructuredProxyInput;
  try {
    input = await readStructuredInput(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message, message }, 400, corsHeaders);
  }

  try {
    const value = await requestStructuredJson(input);
    return json({ value }, 200, corsHeaders);
  } catch (error) {
    const message = sanitizeUpstreamError(error);
    return json({ error: message, message }, 502, corsHeaders);
  }
}

async function readStructuredInput(request: Request): Promise<StructuredProxyInput> {
  const body = (await request.json()) as Record<string, unknown>;
  const baseUrl = readRequiredString(body.baseUrl, 'baseUrl').replace(/\/+$/, '');
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.protocol !== 'http:' && parsedBaseUrl.protocol !== 'https:') {
    throw new Error('Base URL 只支持 http 或 https');
  }

  const schema = body.schema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('schema 格式不正确');
  }

  const timeoutMs =
    typeof body.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
      ? Math.max(5_000, Math.min(10 * 60_000, body.timeoutMs))
      : 60_000;

  return {
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
    baseUrl,
    instructions: readRequiredString(body.instructions, 'instructions'),
    inputText: readRequiredString(body.inputText, 'inputText'),
    model: readRequiredString(body.model, 'model'),
    schema: schema as JsonSchema,
    schemaName: readRequiredString(body.schemaName, 'schemaName'),
    maxOutputTokens:
      typeof body.maxOutputTokens === 'number' && Number.isFinite(body.maxOutputTokens)
        ? body.maxOutputTokens
        : 1800,
    timeoutMs,
    imageDataUrls: Array.isArray(body.imageDataUrls)
      ? body.imageDataUrls.filter((item): item is string => typeof item === 'string')
      : undefined,
    imageDetail: isImageDetail(body.imageDetail) ? body.imageDetail : undefined,
  };
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} 不能为空`);
  }
  return value.trim();
}

async function requestStructuredJson(input: StructuredProxyInput): Promise<unknown> {
  const responsesResult = await requestResponsesApiJson(input);
  if (responsesResult.ok) return responsesResult.value;
  if (!shouldTryChatCompletions(responsesResult)) throw new Error(responsesResult.error);

  const chatResult = await requestChatCompletionsJson(input);
  if (chatResult.ok) return chatResult.value;

  throw new Error(buildNoSupportedGenerationEndpointMessage(responsesResult, chatResult));
}

async function requestResponsesApiJson(
  input: StructuredProxyInput,
): Promise<StructuredRequestResult> {
  const endpoint = endpointUrl(input.baseUrl, '/responses');
  try {
    const payload = await postJson<ResponsesApiSuccess>(
      endpoint,
      input.apiKey,
      {
        model: input.model,
        instructions: input.instructions,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: input.inputText },
              ...(input.imageDataUrls ?? []).map((imageDataUrl) => ({
                type: 'input_image',
                image_url: imageDataUrl,
                detail: resolveInputImageDetail(input.imageDetail ?? 'high'),
              })),
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: input.schemaName,
            strict: true,
            schema: input.schema,
          },
        },
        max_output_tokens: input.maxOutputTokens,
      },
      input.timeoutMs,
    );
    return parseStructuredJsonResult(endpoint, 200, extractResponsesOutputText(payload));
  } catch (error) {
    return buildFailure(endpoint, error, input.timeoutMs);
  }
}

async function requestChatCompletionsJson(
  input: StructuredProxyInput,
): Promise<StructuredRequestResult> {
  const schemaResult = await requestChatCompletionsAttempt(input, 'json_schema');
  if (schemaResult.ok || !shouldRetryChatWithJsonObject(schemaResult)) return schemaResult;
  return requestChatCompletionsAttempt(input, 'json_object');
}

async function requestChatCompletionsAttempt(
  input: StructuredProxyInput,
  responseFormat: 'json_schema' | 'json_object',
): Promise<StructuredRequestResult> {
  const endpoint = endpointUrl(input.baseUrl, '/chat/completions');
  try {
    const payload = await postJson<ChatCompletionsApiSuccess>(
      endpoint,
      input.apiKey,
      {
        model: input.model,
        messages: [
          {
            role: 'system',
            content: `${input.instructions}\n只输出符合要求的 JSON，不要输出 Markdown 或解释。`,
          },
          {
            role: 'user',
            content: buildChatUserContent(input),
          },
        ],
        response_format:
          responseFormat === 'json_schema'
            ? {
                type: 'json_schema',
                json_schema: {
                  name: input.schemaName,
                  strict: true,
                  schema: input.schema,
                },
              }
            : { type: 'json_object' },
        max_tokens: input.maxOutputTokens,
      },
      input.timeoutMs,
    );
    return parseStructuredJsonResult(endpoint, 200, extractChatCompletionOutputText(payload));
  } catch (error) {
    return buildFailure(endpoint, error, input.timeoutMs);
  }
}

async function postJson<T>(
  endpoint: string,
  apiKey: string | undefined,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await response.text();
    const payload = parseJsonBody(text);
    if (!response.ok) {
      throw new UpstreamHttpError(
        response.status,
        extractErrorMessage(payload) || text || response.statusText || `HTTP ${response.status}`,
      );
    }
    return payload as T;
  } finally {
    clearTimeout(timer);
  }
}

function endpointUrl(baseUrl: string, endpoint: '/responses' | '/chat/completions'): string {
  if (baseUrl.endsWith('/v1')) return baseUrl + endpoint;
  return baseUrl + '/v1' + endpoint;
}

function buildChatUserContent(input: StructuredProxyInput) {
  const imageDataUrls = input.imageDataUrls ?? [];
  if (imageDataUrls.length === 0) return input.inputText;
  return [
    { type: 'text', text: input.inputText },
    ...imageDataUrls.map((imageDataUrl) => ({
      type: 'image_url',
      image_url: {
        url: imageDataUrl,
        detail: resolveInputImageDetail(input.imageDetail ?? 'high'),
      },
    })),
  ];
}

function parseStructuredJsonResult(
  endpoint: string,
  status: number | null,
  outputText: string | null,
): StructuredRequestResult {
  if (!outputText) {
    return {
      ok: false,
      endpoint,
      status,
      error: '上游模型没有返回可解析内容。',
      unsupportedEndpoint: false,
    };
  }

  const parsed = parseJsonOutput(outputText);
  if (parsed.ok) return { ok: true, value: parsed.value };
  return {
    ok: false,
    endpoint,
    status,
    error: '上游模型返回了非 JSON 内容。',
    unsupportedEndpoint: false,
  };
}

function parseJsonOutput(value: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = value.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1]?.trim();
  if (fenced) candidates.push(fenced);

  const embeddedObject = extractFirstJsonObject(trimmed);
  if (embeddedObject) candidates.push(embeddedObject);

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown };
    } catch {
      // Try the next candidate.
    }
  }
  return { ok: false };
}

function extractFirstJsonObject(value: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (start < 0) {
      if (char === '{') {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
}

function buildFailure(endpoint: string, error: unknown, timeoutMs: number): StructuredRequestResult {
  if (error instanceof UpstreamHttpError) {
    return {
      ok: false,
      endpoint,
      status: error.httpStatus,
      error: `上游模型请求失败：${error.httpStatus} ${sanitizeUpstreamError(error.message)}`,
      unsupportedEndpoint: isUnsupportedEndpointStatus(error.httpStatus),
    };
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      ok: false,
      endpoint,
      status: null,
      error: `上游模型请求超时（${Math.ceil(timeoutMs / 1000)} 秒），请重试。`,
      unsupportedEndpoint: false,
    };
  }
  return {
    ok: false,
    endpoint,
    status: null,
    error: sanitizeUpstreamError(error),
    unsupportedEndpoint: false,
  };
}

function isUnsupportedEndpointStatus(status: number | null): boolean {
  return status === 404 || status === 405 || status === 501;
}

function shouldTryChatCompletions(result: Extract<StructuredRequestResult, { ok: false }>): boolean {
  return result.unsupportedEndpoint;
}

function shouldRetryChatWithJsonObject(
  result: Extract<StructuredRequestResult, { ok: false }>,
): boolean {
  return (
    result.status !== null &&
    [400, 422].includes(result.status) &&
    /json_schema|response_format|schema|strict/iu.test(result.error)
  );
}

function buildNoSupportedGenerationEndpointMessage(
  responsesResult: Extract<StructuredRequestResult, { ok: false }>,
  chatResult: Extract<StructuredRequestResult, { ok: false }>,
): string {
  return [
    '当前 LLM Base URL 没有可用的结构化生成端点。',
    `Responses API: ${summarizeRequestFailure(responsesResult)}。`,
    `Chat Completions: ${summarizeRequestFailure(chatResult)}。`,
  ].join(' ');
}

function summarizeRequestFailure(result: Extract<StructuredRequestResult, { ok: false }>): string {
  const status = result.status === null ? '请求失败' : `HTTP ${result.status}`;
  return `${status} ${result.endpoint} ${truncateErrorDetail(result.error)}`;
}

function extractResponsesOutputText(payload: ResponsesApiSuccess): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string' && content.text.trim().length > 0) {
        return content.text.trim();
      }
    }
  }
  return null;
}

function extractChatCompletionOutputText(payload: ChatCompletionsApiSuccess): string | null {
  const fragments: string[] = [];
  for (const choice of payload.choices ?? []) {
    if (typeof choice.text === 'string' && choice.text.trim().length > 0) {
      fragments.push(choice.text.trim());
    }
    const content = choice.message?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      fragments.push(content.trim());
    } else if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item.text === 'string' && item.text.trim().length > 0) {
          fragments.push(item.text.trim());
        }
      }
    }
  }
  return fragments.join('\n').trim() || null;
}

function parseJsonBody(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const object = payload as Record<string, unknown>;
  if (typeof object.message === 'string') return object.message;
  const error = object.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const errorObject = error as Record<string, unknown>;
    if (typeof errorObject.message === 'string') return errorObject.message;
  }
  return null;
}

function sanitizeUpstreamError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]+/giu, 'sk-***')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/gu, '***')
    .slice(0, 900);
}

function truncateErrorDetail(error: string): string {
  return error.length > 220 ? `${error.slice(0, 220)}...` : error;
}

function resolveInputImageDetail(detail: StructuredProxyInput['imageDetail']): string {
  return detail === 'original' ? 'high' : (detail ?? 'high');
}

function isImageDetail(value: unknown): value is StructuredProxyInput['imageDetail'] {
  return value === 'auto' || value === 'low' || value === 'high' || value === 'original';
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}
