import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS } from '@/api/models';
import { FIXED_BASE_URL } from '@/api/upstream';
import type { ModelDef } from '@/types/model';
import type { ProviderConfig } from '@/types/provider';
import { importRuntimeConfigFromUrl } from '../urlRuntimeConfig';

const storage = new Map<string, string>();
let replacedUrl = '';

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
});

Object.defineProperty(globalThis, 'document', {
  value: { title: 'TapNow' },
  configurable: true,
});

function setWindowUrl(href: string): void {
  const url = new URL(href);
  replacedUrl = '';
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        href,
        search: url.search,
        hash: url.hash,
      },
      history: {
        state: null,
        replaceState: (_state: unknown, _title: string, nextUrl: URL) => {
          replacedUrl = nextUrl.toString();
        },
      },
    },
    configurable: true,
  });
}

function readPref<T>(key: string): T | null {
  const raw = storage.get(`tapnow_${key}`);
  return raw ? (JSON.parse(raw) as T) : null;
}

describe('importRuntimeConfigFromUrl', () => {
  afterEach(() => {
    storage.clear();
    replacedUrl = '';
  });

  it('imports launch key into global config, auto provider, and default model bindings', () => {
    setWindowUrl('http://canvas.xicily.com/#key=sk-test&access_token=user-access&uid=42');

    expect(importRuntimeConfigFromUrl()).toBe(true);
    expect(readPref<string>('global_key')).toBe('sk-test');
    expect(readPref<string>('access_token')).toBe('user-access');
    expect(readPref<string>('global_base_url')).toBe(FIXED_BASE_URL);
    expect(readPref<string>('user_id')).toBe('42');

    const providers = readPref<ProviderConfig[]>('provider_library') ?? [];
    expect(providers).toContainEqual({
      id: 'new-api-auto',
      name: 'new-api',
      baseUrl: FIXED_BASE_URL,
      apiKey: 'sk-test',
    });

    const overrides = readPref<Record<string, Partial<ModelDef>>>('model_overrides') ?? {};
    for (const model of DEFAULT_MODELS) {
      expect(overrides[model.id]?.providerAssignment).toEqual({
        mode: 'reference',
        providerId: 'new-api-auto',
      });
    }
    expect(replacedUrl).toBe('http://canvas.xicily.com/');
  });

  it('updates the auto provider key without overwriting manual model bindings', () => {
    storage.set(
      'tapnow_provider_library',
      JSON.stringify([
        {
          id: 'new-api-auto',
          name: 'new-api',
          baseUrl: FIXED_BASE_URL,
          apiKey: 'old-key',
        },
      ]),
    );
    storage.set(
      'tapnow_model_overrides',
      JSON.stringify({
        'seedance-2': {
          providerAssignment: {
            mode: 'reference',
            providerId: 'manual-provider',
          },
        },
      }),
    );
    setWindowUrl('http://canvas.xicily.com/#key=sk-new&uid=42');

    expect(importRuntimeConfigFromUrl()).toBe(true);

    const providers = readPref<ProviderConfig[]>('provider_library') ?? [];
    expect(providers.find((provider) => provider.id === 'new-api-auto')?.apiKey).toBe('sk-new');

    const overrides = readPref<Record<string, Partial<ModelDef>>>('model_overrides') ?? {};
    expect(overrides['seedance-2']?.providerAssignment).toEqual({
      mode: 'reference',
      providerId: 'manual-provider',
    });
  });
});
