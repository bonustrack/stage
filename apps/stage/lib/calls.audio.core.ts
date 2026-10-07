import { makeListeners } from './storeCore';

let owned = false;
const recorders = new Set<() => Promise<void>>();
const dictations = new Set<() => Promise<void>>();
let voiceOwner: object | null = null;
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

export function registerDictationRecorder(stop: () => Promise<void>): () => void {
  const unregister = registerCallRecorder(stop);
  dictations.add(stop);
  return () => { unregister(); dictations.delete(stop); };
}

export function voiceOwnsAudio(): boolean {
  return voiceOwner !== null;
}

export async function acquireVoiceAudio(owner: object): Promise<void> {
  if (owned) throw new Error('Leave the call before recording a voice message.');
  if (voiceOwner !== null && voiceOwner !== owner) throw new Error('Stop the other voice recording first.');
  voiceOwner = owner;
  try {
    await Promise.all([...dictations].map(stop => stop()));
    if (owned) throw new Error('Leave the call before recording a voice message.');
  } catch (error) {
    releaseVoiceAudio(owner);
    throw error;
  }
}

export function releaseVoiceAudio(owner: object): void {
  if (voiceOwner === owner) voiceOwner = null;
}

export async function acquireCallAudio(): Promise<void> {
  setOwned(true);
  await Promise.all([...recorders].map(stop => stop()));
}

export function releaseCallAudio(): void {
  setOwned(false);
}
