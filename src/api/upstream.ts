export const FIXED_BASE_URL = 'http://ai.xicily.com';

export const DEFAULT_IMAGE_MODEL = 'wan2.7-image';
export const DEFAULT_IMAGE_MODELS: readonly string[] = [
  'wan2.7-image',
  'wan2.7-image-pro',
];

export function normalizeImageModelId(modelId: string | undefined): string {
  return modelId && DEFAULT_IMAGE_MODELS.includes(modelId)
    ? modelId
    : DEFAULT_IMAGE_MODEL;
}
