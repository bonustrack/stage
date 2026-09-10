import { makeListeners, useStoreValue } from './storeCore';

let held = false;
const { listeners, notify } = makeListeners();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function get(): boolean { return held; }

export function holdOnboarding(next: boolean): void {
  if (held === next) return;
  held = next;
  notify();
}

export function useOnboardingVisible(hasAccount: boolean): boolean {
  const holding = useStoreValue(subscribe, get);
  return !hasAccount || holding;
}
