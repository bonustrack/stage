import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { makeValue } from './storeCore';

const height = makeValue(0);
const reports = new Map<symbol, number>();

function publish(): void {
  const next = Math.max(0, ...reports.values());
  if (next === height.get()) return;
  height.set(next);
}

export function useReportBottomChrome(value: number): void {
  useFocusEffect(useCallback(() => {
    const key = Symbol('bottomChrome');
    reports.set(key, value);
    publish();
    return () => {
      reports.delete(key);
      publish();
    };
  }, [value]));
}

export const useBottomChromeHeight = height.use;
