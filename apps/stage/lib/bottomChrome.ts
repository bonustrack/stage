import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { makeListeners, useStoreValue } from './storeCore';

const { notify, subscribe } = makeListeners();
const reports = new Map<symbol, number>();
let height = 0;

function publish(): void {
  const next = Math.max(0, ...reports.values());
  if (next === height) return;
  height = next;
  notify();
}

function get(): number { return height; }

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

export function useBottomChromeHeight(): number {
  return useStoreValue(subscribe, get);
}
