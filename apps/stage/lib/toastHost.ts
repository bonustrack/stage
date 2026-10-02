import { makeValue } from './storeCore';

interface ToastRequest {
  id: number;
  message: string;
}

const TOAST_MS = 2_500;

const toast = makeValue<ToastRequest | null>(null);
let nextId = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  nextId += 1;
  const request = { id: nextId, message };
  if (hideTimer !== null) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    toast.set(null);
  }, TOAST_MS);
  toast.set(request);
}

export const useToastRequest = toast.use;
