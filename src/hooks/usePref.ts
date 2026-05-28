import { useCallback, useState } from 'react';
import { getPref, setPref } from '@/store/prefs';

/**
 * 双向同步 tapnow_* localStorage 键的 hook：setter 同时写内存态与持久化。
 * 初始值从 localStorage 取，没有则用 fallback。
 */
export function usePref<T>(key: string, fallback: T): readonly [T, (v: T) => void] {
  const [value, setValueState] = useState<T>(() => getPref(key, fallback) as T);
  const setValue = useCallback(
    (v: T) => {
      setValueState(v);
      setPref(key, v);
    },
    [key],
  );
  return [value, setValue] as const;
}
