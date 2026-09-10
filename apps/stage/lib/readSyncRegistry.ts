const hiddenConvs = new Set<string>();

export function registerHiddenConv(convId: string): void {
  hiddenConvs.add(convId);
}

export function isHiddenConv(convId: string | null | undefined): boolean {
  return convId !== null && convId !== undefined && hiddenConvs.has(convId);
}

export interface ReadStateChange {
  convId: string;
  lastReadNs: number;
  markedUnread: boolean;
}

const listeners = new Set<(change: ReadStateChange) => void>();

export function onReadStateChanged(cb: (change: ReadStateChange) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function notifyReadStateChanged(change: ReadStateChange): void {
  for (const cb of listeners) {
    try { cb(change); } catch { }
  }
}

export interface PinChange {
  convId: string;
  pinned: boolean;
}

const pinListeners = new Set<(change: PinChange) => void>();

export function onPinChanged(cb: (change: PinChange) => void): () => void {
  pinListeners.add(cb);
  return () => { pinListeners.delete(cb); };
}

export function notifyPinChanged(change: PinChange): void {
  for (const cb of pinListeners) {
    try { cb(change); } catch { }
  }
}
