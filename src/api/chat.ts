import type { ModelDef } from '@/types/model';
import { request } from './client';
import { apiUrl } from './url';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: ChatRole;
  content: ChatContent;
}

export interface ChatCompletionResult {
  id?: string;
  choices: Array<{
    index?: number;
    message: { role: ChatRole; content: string };
    finish_reason?: string;
  }>;
}

export interface ChatOpts {
  model: ModelDef;
  baseUrl: string;
  apiKey?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function chatComplete(opts: ChatOpts): Promise<ChatCompletionResult> {
  const baseUrl = opts.baseUrl.replace(/\/+$/, '');
  return request<ChatCompletionResult>({
    url: apiUrl(baseUrl, '/v1/chat/completions'),
    method: 'POST',
    apiKey: opts.apiKey,
    body: JSON.stringify({
      model: opts.model.name,
      messages: opts.messages,
      stream: false,
    }),
    bodyKind: 'json',
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  });
}
