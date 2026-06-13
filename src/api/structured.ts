import { ApiError, TimeoutError } from './errors';
import { request } from './client';

export type JsonSchema = {
  type: string;
  [key: string]: unknown;
};

type StructuredRequestInput = {
  apiKey?: string;
  baseUrl: string;
  instructions: string;
  inputText: string;
  model: string;
  schema: JsonSchema;
  schemaName: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  imageDataUrls?: string[];
  imageDetail?: 'auto' | 'low' | 'high' | 'original';
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

type StructuredProxyResponse = {
  value?: unknown;
  error?: string;
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

export async function requestStructuredJson(input: StructuredRequestInput): Promise<unknown> {
  const responsesResult = await requestResponsesApiJson(input);
  if (responsesResult.ok) return responsesResult.value;
  if (!shouldTryChatCompletions(responsesResult)) {
    if (shouldTryServerStructuredProxy(responsesResult)) {
      return requestStructuredJsonViaServer(input, responsesResult.error);
    }
    throw new Error(responsesResult.error);
  }

  const chatResult = await requestChatCompletionsJson(input);
  if (chatResult.ok) return chatResult.value;

  const failureMessage = buildNoSupportedGenerationEndpointMessage(responsesResult, chatResult);
  if (shouldTryServerStructuredProxy(responsesResult) || shouldTryServerStructuredProxy(chatResult)) {
    return requestStructuredJsonViaServer(input, failureMessage);
  }

  throw new Error(failureMessage);
}

async function requestStructuredJsonViaServer(
  input: StructuredRequestInput,
  directFailure: string,
): Promise<unknown> {
  try {
    const payload = await request<StructuredProxyResponse>({
      url: '/api/structured',
      method: 'POST',
      bodyKind: 'json',
      body: JSON.stringify(input),
      timeoutMs: input.timeoutMs ?? 60_000,
      maxRetries: 1,
    });
    if (!Object.prototype.hasOwnProperty.call(payload, 'value')) {
      throw new Error(payload.error || '本地结构化代理响应缺少 value');
    }
    return payload.value;
  } catch (error) {
    throw new Error(
      `浏览器直连结构化接口失败：${truncateErrorDetail(directFailure)}。本地代理也失败：${sanitizeUpstreamError(error)}`,
    );
  }
}

function endpointUrl(baseUrl: string, endpoint: '/responses' | '/chat/completions'): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (base.endsWith('/v1')) return base + endpoint;
  return base + '/v1' + endpoint;
}

async function requestResponsesApiJson(
  input: StructuredRequestInput,
): Promise<StructuredRequestResult> {
  const endpoint = endpointUrl(input.baseUrl, '/responses');
  try {
    const payload = await request<ResponsesApiSuccess>({
      url: endpoint,
      method: 'POST',
      apiKey: input.apiKey,
      bodyKind: 'json',
      body: JSON.stringify({
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
      }),
      timeoutMs: input.timeoutMs ?? 60_000,
    });
    return parseStructuredJsonResult(endpoint, 200, extractResponsesOutputText(payload));
  } catch (error) {
    return buildFailure(endpoint, error, input.timeoutMs ?? 60_000);
  }
}

async function requestChatCompletionsJson(
  input: StructuredRequestInput,
): Promise<StructuredRequestResult> {
  const schemaResult = await requestChatCompletionsAttempt(input, 'json_schema');
  if (schemaResult.ok || !shouldRetryChatWithJsonObject(schemaResult)) return schemaResult;
  return requestChatCompletionsAttempt(input, 'json_object');
}

async function requestChatCompletionsAttempt(
  input: StructuredRequestInput,
  responseFormat: 'json_schema' | 'json_object',
): Promise<StructuredRequestResult> {
  const endpoint = endpointUrl(input.baseUrl, '/chat/completions');
  try {
    const payload = await request<ChatCompletionsApiSuccess>({
      url: endpoint,
      method: 'POST',
      apiKey: input.apiKey,
      bodyKind: 'json',
      body: JSON.stringify({
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
      }),
      timeoutMs: input.timeoutMs ?? 60_000,
    });
    return parseStructuredJsonResult(endpoint, 200, extractChatCompletionOutputText(payload));
  } catch (error) {
    return buildFailure(endpoint, error, input.timeoutMs ?? 60_000);
  }
}

function buildChatUserContent(input: StructuredRequestInput) {
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

export function parseJsonOutput(value: string): { ok: true; value: unknown } | { ok: false } {
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
  if (error instanceof TimeoutError) {
    return {
      ok: false,
      endpoint,
      status: null,
      error: `上游模型请求超时（${Math.ceil(timeoutMs / 1000)} 秒），请重试。`,
      unsupportedEndpoint: false,
    };
  }
  if (error instanceof ApiError) {
    return {
      ok: false,
      endpoint,
      status: error.httpStatus,
      error: `上游模型请求失败：${error.httpStatus} ${sanitizeUpstreamError(error.message)}`,
      unsupportedEndpoint: isUnsupportedEndpointStatus(error.httpStatus),
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

function shouldTryServerStructuredProxy(
  result: Extract<StructuredRequestResult, { ok: false }>,
): boolean {
  return (
    result.status === null &&
    /failed to fetch|networkerror|network error|load failed|fetch failed|cors/iu.test(result.error)
  );
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

function resolveInputImageDetail(detail: StructuredRequestInput['imageDetail']): string {
  return detail === 'original' ? 'high' : (detail ?? 'high');
}
