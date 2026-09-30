let owned = false;
const recorders = new Set<() => Promise<void>>();
const listeners = new Set<() => void>();

export function subscribeCallAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function setOwned(value: boolean): void {
  owned = value;
  for (const listener of listeners) listener();
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
