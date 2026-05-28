import { afterEach, describe, expect, it } from 'vitest';
import { getModelDef } from '../models';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  },
  configurable: true,
});

describe('getModelDef', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('applies provider assignment overrides to default models', () => {
    localStorage.setItem(
      'tapnow_model_overrides',
      JSON.stringify({
        'doubao-seedance-2-0-260128': {
          providerAssignment: {
            mode: 'reference',
            providerId: 'new-api',
          },
        },
      }),
    );

    expect(getModelDef('doubao-seedance-2-0-260128')?.providerAssignment).toEqual({
      mode: 'reference',
      providerId: 'new-api',
    });
  });
});
