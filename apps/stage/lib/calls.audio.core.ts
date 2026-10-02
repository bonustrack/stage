import { makeListeners } from './storeCore';

let owned = false;
const recorders = new Set<() => Promise<void>>();
const listeners = makeListeners();

export const subscribeCallAudio = listeners.subscribe;

function setOwned(value: boolean): void {
  owned = value;
  listeners.notify();
}

export function callOwnsAudio(): boolean {
  return owned;
}

export function registerCallRecorder(stop: () => Promise<void>): () => void {
  recorders.add(stop);
  return () => { recorders.delete(stop); };
}

export async function acquireCallAudio(): Promise<void> {
  setOwned(true);
  await Promise.all([...recorders].map(stop => stop()));
}

export function releaseCallAudio(): void {
  setOwned(false);
}
