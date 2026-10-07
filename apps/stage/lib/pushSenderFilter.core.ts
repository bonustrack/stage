import { sha256 } from 'viem';
import {
  SENDER_FILTER_BATCH_SIZE, senderFilterTopics, signedSenderFilters, type SenderFilterTopic,
} from '@stage-labs/client/xmtp/pushServer';
import type { PushTopics } from './pushRegistration.core';
import { abortable } from './abortable.core';

export interface SenderFilterInput {
  installationId: string;
  current: () => boolean;
  signal: AbortSignal;
  groupKey: () => Promise<string>;
  sign: (text: string) => Promise<Uint8Array>;
  syncPreferences: () => Promise<unknown>;
  collectTopics: (topic?: string) => Promise<PushTopics>;
  topic?: string;
  post: (body: { payload: string; signature: string }, signal: AbortSignal) => Promise<void>;
}

export async function maintainPushPaths(publish: () => Promise<void>, receive: () => Promise<void>): Promise<void> {
  const results = await Promise.allSettled([publish(), receive()]);
  const failed = results.find(result => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export async function prepareNotifyingSend(shouldPush: boolean, prepare: () => Promise<void>, assertCurrent: () => void): Promise<void> {
  assertCurrent();
  if (shouldPush) await prepare();
  assertCurrent();
}

interface Published { signature: string; at: number }

export function makeSenderFilterPublisher(now = Date.now, timeoutMs = 30_000) {
  const pending = new Map<string, Promise<void>>();
  const published = new Map<string, Map<string, Published>>();

  async function update(input: SenderFilterInput, signal: AbortSignal): Promise<void> {
    const assertCurrent = (): void => { if (!input.current() || signal.aborted) throw new Error('Sender filter account changed'); };
    assertCurrent();
    await input.syncPreferences();
    assertCurrent();
    const collected = await input.collectTopics(input.topic);
    assertCurrent();
    const selected = input.topic ? collected.topics.filter(topic => topic === input.topic) : collected.topics;
    const topics = senderFilterTopics(selected, collected.hmacKeys);
    if (input.topic && topics.length === 0) throw new Error('Sender filter key is not ready');
    const groupKey = await input.groupKey();
    assertCurrent();
    const cache = published.get(input.installationId) ?? new Map<string, Published>();
    const dirty = topics.filter(topic => {
      const prev = cache.get(topic.topic);
      return !prev || prev.signature !== fingerprint(groupKey, topic) || now() - prev.at >= 240_000;
    });
    const groupSignature = sha256(new TextEncoder().encode(groupKey));
    if (dirty.length === 0 && cache.get('')?.signature === groupSignature) return;
    for (let start = 0; start < Math.max(dirty.length, 1); start += SENDER_FILTER_BATCH_SIZE) {
      const batch = dirty.slice(start, start + SENDER_FILTER_BATCH_SIZE);
      const body = await signedSenderFilters(input.installationId, groupKey, batch, Math.floor(now() / 1_000), input.sign);
      assertCurrent();
      await input.post(body, signal);
      assertCurrent();
      for (const topic of batch) cache.set(topic.topic, { signature: fingerprint(groupKey, topic), at: now() });
      cache.set('', { signature: groupSignature, at: now() });
      published.set(input.installationId, cache);
    }
  }

  async function publish(input: SenderFilterInput): Promise<void> {
    const controller = new AbortController();
    const abort = (): void => { controller.abort(new Error('Sender filter refresh cancelled')); };
    if (input.signal.aborted) abort();
    else input.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { controller.abort(new Error('Sender filter refresh timed out')); }, timeoutMs);
    const previous = pending.get(input.installationId);
    const run = (): Promise<void> => abortable(update(input, controller.signal), controller.signal);
    const next = previous ? previous.then(run, run) : run();
    pending.set(input.installationId, next);
    const release = (): void => { if (pending.get(input.installationId) === next) pending.delete(input.installationId); };
    void next.then(release, release);
    try { await abortable(next, controller.signal); }
    finally { clearTimeout(timer); input.signal.removeEventListener('abort', abort); }
  }

  return { publish, clear: () => { published.clear(); } };
}

function fingerprint(groupKey: string, topic: SenderFilterTopic): string {
  return sha256(new TextEncoder().encode(JSON.stringify([groupKey, topic])));
}
