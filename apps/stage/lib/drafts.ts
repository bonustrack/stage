import { useEffect, useReducer } from 'react';
import { z } from 'zod';
import { PersistentStore } from './cache.shared';
import { createValueStore } from './persistedStore';
import { valueWith } from './storeCore';

const PERSIST_DEBOUNCE_MS = 800;

type Drafts = Record<string, unknown>;

const store = new PersistentStore<Drafts>('composer-drafts.json', {
  parse: valueWith(z.record(z.unknown())),
  flushDelayMs: PERSIST_DEBOUNCE_MS,
});

export async function loadDrafts(): Promise<void> {
  await store.hydrate();
}

export function getDraftValue(key: string): unknown {
  return store.get()?.[key];
}

export function getDraft(convId: string): string {
  const draft = getDraftValue(convId);
  return typeof draft === 'string' ? draft : '';
}

function withDraft(drafts: Drafts | null, key: string, value: unknown): Drafts | null {
  const next = { ...drafts };
  if (value === undefined) Reflect.deleteProperty(next, key);
  else next[key] = value;
  return Object.keys(next).length ? next : null;
}

export function setDraftValue(key: string, value: unknown): void {
  store.update((drafts) => withDraft(drafts, key, value));
}

export function setDraft(convId: string, text: string): void {
  setDraftValue(convId, text.trim() ? text : undefined);
}

export function subscribeDrafts(onChange: () => void): () => void {
  return store.subscribe(onChange);
}

export function useDraftsVersion(): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    void loadDrafts();
    return subscribeDrafts(() => {
      bump();
    });
  }, []);
  return version;
}

const STORED_ATTACHMENT_NAMES = {
  voice: 'Voice message',
  image: 'Image',
  camera: 'Camera',
  file: 'File',
  location: 'Location',
  poll: 'Poll',
  sign: 'Sign',
  payment: 'Payment',
} as const;

export type AttachmentId = keyof typeof STORED_ATTACHMENT_NAMES;

const ATTACHMENT_IDS = Object.keys(STORED_ATTACHMENT_NAMES) as AttachmentId[];

const lastAttachment = createValueStore<AttachmentId | undefined>({
  key: 'composer:lastAttachment',
  default: undefined,
  serialize: (id) => (id === undefined ? '' : STORED_ATTACHMENT_NAMES[id]),
  deserialize: (stored) => ATTACHMENT_IDS.find((id) => STORED_ATTACHMENT_NAMES[id] === stored),
});

export const setLastAttachment = (id: AttachmentId): void => {
  lastAttachment.set(id);
};

export const useLastAttachment = (): AttachmentId | undefined => lastAttachment.use();
