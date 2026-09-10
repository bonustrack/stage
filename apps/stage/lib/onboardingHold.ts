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

export interface ShellGates {
  showOnboarding: boolean;
  sidebarVisible: boolean;
}

export function useShellGates(gatesOpen: boolean, hasAccount: boolean): ShellGates {
  const holding = useStoreValue(subscribe, get);
  const showOnboarding = !hasAccount || holding;
  return { showOnboarding, sidebarVisible: gatesOpen && hasAccount && !showOnboarding };
}
