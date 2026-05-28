import type { ModelParameter } from '@/types/model';
import { getPref, setPref } from '@/store/prefs';

const PARAM_PREFIX = 'model_param_';

export function validateParameter(param: ModelParameter, value: unknown): boolean {
  switch (param.type) {
    case 'text':
      return typeof value === 'string';
    case 'number':
      if (typeof value !== 'number') return false;
      if (param.min !== undefined && value < param.min) return false;
      if (param.max !== undefined && value > param.max) return false;
      return true;
    case 'boolean':
      return typeof value === 'boolean';
    case 'select':
      if (typeof value !== 'string') return false;
      return param.options?.some((opt) => opt.value === value) ?? false;
    default:
      return false;
  }
}

export function getParameterValue(
  modelId: string,
  paramKey: string,
  defaultValue: string | number | boolean,
): string | number | boolean {
  const key = `${PARAM_PREFIX}${modelId}_${paramKey}`;
  return getPref(key, defaultValue);
}

export function setParameterValue(
  modelId: string,
  paramKey: string,
  value: string | number | boolean,
): void {
  const key = `${PARAM_PREFIX}${modelId}_${paramKey}`;
  setPref(key, value);
}

export function getAllParameterValues(
  modelId: string,
  parameters: ModelParameter[],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const param of parameters) {
    result[param.key] = getParameterValue(modelId, param.key, param.defaultValue);
  }
  return result;
}

export function clearParameterValues(modelId: string, parameters: ModelParameter[]): void {
  for (const param of parameters) {
    const key = `${PARAM_PREFIX}${modelId}_${param.key}`;
    try {
      localStorage.removeItem(`tapnow_${key}`);
    } catch {
      /* noop */
    }
  }
}
