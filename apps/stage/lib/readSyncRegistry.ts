import { makeListeners } from './storeCore';

const hiddenConvs = new Set<string>();

export function registerHiddenConv(convId: string): void {
  hiddenConvs.add(convId);
}

export function isHiddenConv(convId: string | null | undefined): boolean {
  return convId !== null && convId !== undefined && hiddenConvs.has(convId);
}

let activeConvId: string | null = null;

export function setActiveConvId(convId: string | null): void {
  activeConvId = convId ? convId.toLowerCase() : null;
}

export function isActiveConv(convId: string | null | undefined): boolean {
  if (!convId || !activeConvId) return false;
  return convId.toLowerCase() === activeConvId;
}

export interface ReadStateChange {
  convId: string;
  lastReadNs: number;
  markedUnread: boolean;
}

const readListeners = makeListeners<ReadStateChange>();

export const onReadStateChanged = readListeners.subscribe;
export const notifyReadStateChanged = readListeners.notify;

export interface PinChange {
  convId: string;
  pinned: boolean;
  order: readonly string[];
}

const pinListeners = makeListeners<PinChange>();

export const onPinChanged = pinListeners.subscribe;
export const notifyPinChanged = pinListeners.notify;

const clearedListeners = makeListeners();

export const onClearedChatsChanged = clearedListeners.subscribe;
export const notifyClearedChatsChanged = clearedListeners.notify;
