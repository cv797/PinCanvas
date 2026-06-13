/**
 * 默认 API 基础地址。
 *
 * 开源版默认空字符串，要求用户在「设置 → 服务商配置」中显式填写自己的
 * OpenAI 兼容网关地址（例如 https://api.openai.com 或自部署网关）。
 *
 * 留作兼容入口：旧版本通过 setPref('global_base_url', ...) 写入的值仍优先生效。
 */
export const FIXED_BASE_URL = '';

export const DEFAULT_IMAGE_MODEL = 'wan2.7-image';
export const DEFAULT_IMAGE_MODELS: readonly string[] = [
  'wan2.7-image',
  'wan2.7-image-pro',
];

export function normalizeImageModelId(modelId: string | undefined): string {
  return modelId || DEFAULT_IMAGE_MODEL;
}
