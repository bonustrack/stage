import { makeListeners, useStoreValue } from './storeCore';

export interface ToastRequest {
  id: number;
  message: string;
}

const TOAST_MS = 2_500;

let current: ToastRequest | null = null;
let nextId = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const { notify, subscribe } = makeListeners();

function get(): ToastRequest | null { return current; }

export function showToast(message: string): void {
  nextId += 1;
  current = { id: nextId, message };
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    current = null;
    notify();
  }, TOAST_MS);
  notify();
}

export function useToastRequest(): ToastRequest | null {
  return useStoreValue(subscribe, get);
}
