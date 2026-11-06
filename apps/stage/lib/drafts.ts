import { useEffect, useReducer } from 'react';
import { PersistentStore } from './cache.shared';
import { createValueStore } from './persistedStore';

const PERSIST_DEBOUNCE_MS = 800;

const store = new PersistentStore<Record<string, unknown>>('composer-drafts.json', PERSIST_DEBOUNCE_MS);

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

export function setDraftValue(key: string, value: unknown): void {
  const next = { ...store.get() };
  if (value === undefined) Reflect.deleteProperty(next, key);
  else next[key] = value;
  store.set(Object.keys(next).length ? next : null);
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

const LAST_ATTACHMENT_KEY = 'composer:lastAttachment';

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

function attachmentIdOf(stored: string): AttachmentId | undefined {
  return ATTACHMENT_IDS.find((id) => STORED_ATTACHMENT_NAMES[id] === stored);
}

const lastAttachment = createValueStore<AttachmentId | undefined>({
  key: LAST_ATTACHMENT_KEY,
  default: undefined,
  serialize: (id) => (id === undefined ? '' : STORED_ATTACHMENT_NAMES[id]),
  deserialize: attachmentIdOf,
});

export const setLastAttachment = (id: AttachmentId): void => {
  lastAttachment.set(id);
};

export const useLastAttachment = (): AttachmentId | undefined => lastAttachment.use();
