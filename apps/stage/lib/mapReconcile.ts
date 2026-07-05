
import { useRef } from 'react';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function setEquals(a: Set<unknown>, b: Set<unknown>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function mapEquals(a: Map<unknown, unknown>, b: Map<unknown, unknown>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k) || !deepValueEquals(v, b.get(k))) return false;
  }
  return true;
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => deepValueEquals(v, b[i]));
}

function recordEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => deepValueEquals(a[k], b[k]));
}

function collectionEquals(a: unknown, b: unknown): boolean | null {
  if (a instanceof Map) return b instanceof Map && mapEquals(a, b);
  if (a instanceof Set) return b instanceof Set && setEquals(a, b);
  if (Array.isArray(a)) return Array.isArray(b) && arrayEquals(a, b);
  return null;
}

export function deepValueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const collections = collectionEquals(a, b);
  if (collections !== null) return collections;
  return isRecord(a) && isRecord(b) && recordEquals(a, b);
}

export function reconcileMapValues<K, V>(prev: Map<K, V>, next: Map<K, V>): Map<K, V> {
  if (prev === next) return next;
  const out = new Map<K, V>();
  let allReused = prev.size === next.size;
  for (const [key, value] of next) {
    const before = prev.get(key);
    if (before !== undefined && deepValueEquals(before, value)) {
      out.set(key, before);
    } else {
      out.set(key, value);
      allReused = false;
    }
  }
  return allReused ? prev : out;
}

export function useReconciledMap<K, V>(next: Map<K, V>): Map<K, V> {
  const prevRef = useRef(next);
  const out = reconcileMapValues(prevRef.current, next);
  prevRef.current = out;
  return out;
}
