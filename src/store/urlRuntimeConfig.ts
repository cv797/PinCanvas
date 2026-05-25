import { DEFAULT_MODELS } from '@/api/models';
import { FIXED_BASE_URL } from '@/api/upstream';
import type { ModelDef } from '@/types/model';
import type { ProviderConfig } from '@/types/provider';
import { getPref, setPref } from './prefs';

const API_KEY_PARAMS = ['key', 'apiKey', 'api_key'] as const;
const ACCESS_TOKEN_PARAMS = ['access_token', 'accessToken', 'user_token', 'userToken'] as const;
const USER_ID_PARAMS = ['uid', 'user', 'userId', 'user_id'] as const;
const LINK_TS_PARAMS = ['ts', 'timestamp'] as const;
const LINK_SIG_PARAMS = ['sig', 'signature'] as const;
const AUTO_PROVIDER_ID = 'new-api-auto';
const AUTO_PROVIDER_NAME = 'new-api';

export function importRuntimeConfigFromUrl(): boolean {
  if (typeof window === 'undefined') return false;

  const config = findRuntimeConfig(window.location);
  if (!hasRuntimeConfig(config)) return false;

  if (config.apiKey) {
    setPref('global_key', config.apiKey);
    setPref('global_base_url', FIXED_BASE_URL);
    upsertAutoProvider(config.apiKey);
    bindDefaultModelsToAutoProvider();
  }
  if (config.accessToken) setPref('access_token', config.accessToken);
  if (config.userId) setPref('user_id', config.userId);
  if (config.linkTs) setPref('link_ts', config.linkTs);
  if (config.linkSig) setPref('link_sig', config.linkSig);
  removeRuntimeConfigFromAddressBar(window.location, window.history);
  return true;
}

interface RuntimeConfig {
  apiKey: string | null;
  accessToken: string | null;
  userId: string | null;
  linkTs: string | null;
  linkSig: string | null;
}

function findRuntimeConfig(location: Location): RuntimeConfig {
  return mergeRuntimeConfig(
    findRuntimeConfigInHash(location.hash),
    findRuntimeConfigInParams(new URLSearchParams(location.search)),
  );
}

function findRuntimeConfigInHash(hash: string): RuntimeConfig {
  const content = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!content) return emptyRuntimeConfig();

  const queryStart = content.indexOf('?');
  const paramText = queryStart >= 0 ? content.slice(queryStart + 1) : content;
  return findRuntimeConfigInParams(new URLSearchParams(paramText));
}

function findRuntimeConfigInParams(params: URLSearchParams): RuntimeConfig {
  return {
    apiKey: findFirstParam(params, API_KEY_PARAMS),
    accessToken: findFirstParam(params, ACCESS_TOKEN_PARAMS),
    userId: findFirstParam(params, USER_ID_PARAMS),
    linkTs: findFirstParam(params, LINK_TS_PARAMS),
    linkSig: findFirstParam(params, LINK_SIG_PARAMS),
  };
}

function findFirstParam(
  params: URLSearchParams,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

function mergeRuntimeConfig(primary: RuntimeConfig, fallback: RuntimeConfig): RuntimeConfig {
  return {
    apiKey: primary.apiKey ?? fallback.apiKey,
    accessToken: primary.accessToken ?? fallback.accessToken,
    userId: primary.userId ?? fallback.userId,
    linkTs: primary.linkTs ?? fallback.linkTs,
    linkSig: primary.linkSig ?? fallback.linkSig,
  };
}

function emptyRuntimeConfig(): RuntimeConfig {
  return {
    apiKey: null,
    accessToken: null,
    userId: null,
    linkTs: null,
    linkSig: null,
  };
}

function hasRuntimeConfig(config: RuntimeConfig): boolean {
  return Boolean(
    config.apiKey || config.accessToken || config.userId || config.linkTs || config.linkSig,
  );
}

function removeRuntimeConfigFromAddressBar(location: Location, history: History): void {
  const url = new URL(location.href);
  let changed = removeRuntimeConfigParams(url.searchParams);

  if (url.hash) {
    const nextHash = removeRuntimeConfigFromHash(url.hash);
    if (nextHash !== url.hash) {
      url.hash = nextHash;
      changed = true;
    }
  }

  if (changed) history.replaceState(history.state, document.title, url);
}

function removeRuntimeConfigFromHash(hash: string): string {
  const content = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryStart = content.indexOf('?');
  const hasRoutePrefix = queryStart >= 0;
  const prefix = hasRoutePrefix ? content.slice(0, queryStart) : '';
  const paramText = hasRoutePrefix ? content.slice(queryStart + 1) : content;
  const params = new URLSearchParams(paramText);

  if (!removeRuntimeConfigParams(params)) return hash;

  const nextParams = params.toString();
  if (hasRoutePrefix) return nextParams ? `#${prefix}?${nextParams}` : `#${prefix}`;
  return nextParams ? `#${nextParams}` : '';
}

function removeRuntimeConfigParams(params: URLSearchParams): boolean {
  let changed = false;
  for (const name of [
    ...API_KEY_PARAMS,
    ...ACCESS_TOKEN_PARAMS,
    ...USER_ID_PARAMS,
    ...LINK_TS_PARAMS,
    ...LINK_SIG_PARAMS,
  ]) {
    if (!params.has(name)) continue;
    params.delete(name);
    changed = true;
  }
  return changed;
}

function upsertAutoProvider(apiKey: string): void {
  const providers = getPref<ProviderConfig[]>('provider_library', []);
  const autoProvider: ProviderConfig = {
    id: AUTO_PROVIDER_ID,
    name: AUTO_PROVIDER_NAME,
    baseUrl: FIXED_BASE_URL,
    apiKey,
  };
  const exists = providers.some((provider) => provider.id === AUTO_PROVIDER_ID);
  const next = exists
    ? providers.map((provider) =>
        provider.id === AUTO_PROVIDER_ID
          ? {
              ...provider,
              name: provider.name || AUTO_PROVIDER_NAME,
              baseUrl: FIXED_BASE_URL,
              apiKey,
            }
          : provider,
      )
    : [...providers, autoProvider];
  setPref('provider_library', next);
}

function bindDefaultModelsToAutoProvider(): void {
  const overrides = getPref<Record<string, Partial<ModelDef>>>('model_overrides', {});
  let changed = false;
  const next: Record<string, Partial<ModelDef>> = { ...overrides };

  for (const model of DEFAULT_MODELS) {
    const override = next[model.id] ?? {};
    if (hasManualProviderBinding(override)) continue;
    next[model.id] = {
      ...override,
      providerAssignment: {
        mode: 'reference',
        providerId: AUTO_PROVIDER_ID,
      },
    };
    changed = true;
  }

  if (changed) setPref('model_overrides', next);
}

function hasManualProviderBinding(override: Partial<ModelDef>): boolean {
  const assignment = override.providerAssignment;
  if (!assignment || assignment.mode === 'global') return false;
  if (assignment.mode === 'reference') {
    return assignment.providerId !== AUTO_PROVIDER_ID;
  }
  return true;
}
