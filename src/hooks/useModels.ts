import { useMemo } from 'react';
import { DEFAULT_MODELS } from '@/api/models';
import { useModelLibrary } from '@/store/models';
import type { Modality, ModelDef } from '@/types/model';

/**
 * 合并 DEFAULT_MODELS + 用户自定义库。
 * 可选按 modality 过滤。
 * 用户库变化会触发组件 re-render。
 */
export function useModels(modality?: Modality): ModelDef[] {
  const userModels = useModelLibrary((s) => s.userModels);
  const modelOverrides = useModelLibrary((s) => s.modelOverrides);
  return useMemo(() => {
    const defaultModels = DEFAULT_MODELS.map((model) => ({
      ...model,
      ...modelOverrides[model.id],
    }));
    const all = [...defaultModels, ...userModels];
    const visible = all.filter((m) => !m.hidden);
    const filtered = modality ? visible.filter((m) => m.modality === modality) : visible;
    if (modality === 'video') {
      return [...filtered].sort((a, b) => videoModelPriority(a) - videoModelPriority(b));
    }
    return filtered;
  }, [modelOverrides, userModels, modality]);
}

function videoModelPriority(model: ModelDef): number {
  const haystack = `${model.id} ${model.name} ${model.group ?? ''}`.toLowerCase();
  if (haystack.includes('happyhorse')) return 0;
  if (haystack.includes('kling')) return 1;
  if (haystack.includes('seedance')) return 2;
  return 3;
}
