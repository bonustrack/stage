import { sha256 } from 'viem';
import {
  SENDER_FILTER_BATCH_SIZE, senderFilterTopics, signedSenderFilters, type SenderFilterTopic,
} from '@stage-labs/client/xmtp/pushServer';
import type { PushTopics } from './pushRegistration.core';
import { abortable } from './abortable.core';
import { timeSendPhase, type SendTiming } from './sendTiming.core';

export interface SenderFilterInput {
  installationId: string;
  current: () => boolean;
  signal: AbortSignal;
  groupKey: () => Promise<string>;
  sign: (text: string) => Promise<Uint8Array>;
  syncPreferences: () => Promise<unknown>;
  collectTopics: (topic?: string) => Promise<PushTopics>;
  topic?: string;
  timing?: SendTiming;
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
interface Prepared { groupKey: string; topics: SenderFilterTopic[]; version: number; preferences: number }
interface Revision {
  publication: number;
  preferences: number;
  topics: Map<string, number>;
  group?: { key: string; version: number };
}
type PublicationResult = 'retry' | 'unchanged' | 'done' | 'more';
type SyncInput = Pick<SenderFilterInput, 'installationId' | 'syncPreferences'>;

export function makeSenderFilterPublisher(now = Date.now, timeoutMs = 30_000, syncFreshMs = 30_000) {
  const pending = new Map<string, Promise<PublicationResult>>();
  const published = new Map<string, Map<string, Published>>();
  const revisions = new Map<string, Revision>();
  const preferences = makePreferenceSync(now, syncFreshMs, revisions);
  let epoch = 0;

  async function warm(input: SyncInput & Pick<SenderFilterInput, 'current'>): Promise<void> {
    if (!input.current()) return;
    const capturedEpoch = epoch;
    await preferences.sync(input, () => {
      if (capturedEpoch !== epoch || !input.current()) throw new Error('Sender filter account changed');
    });
  }

  async function prepare(input: SenderFilterInput, signal: AbortSignal, assertCurrent: () => void): Promise<Prepared> {
    assertCurrent();
    await timeSendPhase(input.timing, 'filter.preferences', () => preferences.sync(input, assertCurrent, signal));
    const revision = revisionFor(revisions, input.installationId);
    const version = revision.publication;
    const imported = revision.preferences;
    const collected = await timeSendPhase(input.timing, 'filter.keys', () => input.collectTopics(input.topic));
    assertCurrent();
    const selected = input.topic ? collected.topics.filter(topic => topic === input.topic) : collected.topics;
    const topics = senderFilterTopics(selected, collected.hmacKeys);
    if (input.topic && topics.length === 0) throw new Error('Sender filter key is not ready');
    const groupKey = await timeSendPhase(input.timing, 'filter.group_key', () => input.groupKey());
    assertCurrent();
    return { groupKey, topics, version, preferences: imported };
  }

  async function update(input: SenderFilterInput, prepared: Prepared, signal: AbortSignal, assertCurrent: () => void): Promise<PublicationResult> {
    assertCurrent();
    const revision = revisionFor(revisions, input.installationId);
    if (stalePreparation(prepared, revision)) return 'retry';
    const { groupKey, topics } = prepared;
    const cache = published.get(input.installationId) ?? new Map<string, Published>();
    const dirty = topics.filter(topic => {
      const prev = cache.get(topic.topic);
      return !prev || prev.signature !== fingerprint(groupKey, topic) || now() - prev.at >= 240_000;
    });
    const groupSignature = sha256(new TextEncoder().encode(groupKey));
    if (dirty.length === 0 && cache.get('')?.signature === groupSignature) return 'unchanged';
    const batch = dirty.slice(0, SENDER_FILTER_BATCH_SIZE);
    const version = beginPublication(revision, groupKey, batch);
    const body = await timeSendPhase(input.timing, 'filter.sign', () =>
      signedSenderFilters(input.installationId, groupKey, batch, Math.floor(now() / 1_000), input.sign));
    assertCurrent();
    if (prepared.preferences !== revision.preferences) return 'retry';
    await timeSendPhase(input.timing, 'filter.http', () => input.post(body, signal));
    assertCurrent();
    for (const topic of batch) cache.set(topic.topic, { signature: fingerprint(groupKey, topic), at: now() });
    cache.set('', { signature: groupSignature, at: now() });
    published.set(input.installationId, cache);
    prepared.version = version;
    if (prepared.preferences !== revision.preferences) return 'retry';
    return dirty.length <= SENDER_FILTER_BATCH_SIZE ? 'done' : 'more';
  }

  async function publish(input: SenderFilterInput): Promise<void> {
    const controller = new AbortController();
    const capturedEpoch = epoch;
    const assertCurrent = (): void => {
      if (capturedEpoch !== epoch || !input.current() || controller.signal.aborted) throw new Error('Sender filter account changed');
    };
    const abort = (): void => { controller.abort(new Error('Sender filter refresh cancelled')); };
    if (input.signal.aborted) abort();
    else input.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { controller.abort(new Error('Sender filter refresh timed out')); }, timeoutMs);
    try {
      let prepared = await abortable(prepare(input, controller.signal, assertCurrent), controller.signal);
      while (true) {
        const result = await queuePublication(pending, input, controller.signal, async waited => {
          if (input.topic && waited) prepared = await prepare(input, controller.signal, assertCurrent);
          return update(input, prepared, controller.signal, assertCurrent);
        });
        if (result === 'done' || result === 'unchanged') return;
        if (result === 'retry') prepared = await abortable(prepare(input, controller.signal, assertCurrent), controller.signal);
      }
    } finally { clearTimeout(timer); input.signal.removeEventListener('abort', abort); }
  }

  return { publish, warm, clear: () => { epoch += 1; published.clear(); revisions.clear(); preferences.clear(); } };
}

function makePreferenceSync(now: () => number, freshMs: number, revisions: Map<string, Revision>) {
  const syncedAt = new Map<string, number>();
  const syncing = new Map<string, Promise<number>>();
  function start(input: SyncInput): Promise<number> {
    const known = syncing.get(input.installationId);
    if (known) return known;
    const started = now();
    const revision = revisionFor(revisions, input.installationId);
    revision.preferences += 1;
    const run = input.syncPreferences().then(() => started).finally(() => { revision.preferences += 1; });
    syncing.set(input.installationId, run);
    const release = (): void => { if (syncing.get(input.installationId) === run) syncing.delete(input.installationId); };
    void run.then(release, release);
    return run;
  }
  async function sync(input: SyncInput, assertCurrent: () => void, signal?: AbortSignal): Promise<void> {
    const known = syncing.get(input.installationId);
    const last = syncedAt.get(input.installationId);
    if (!known && last !== undefined && now() - last < freshMs) return;
    const run = known ?? start(input);
    let started: number;
    try { started = await (signal ? abortable(run, signal) : run); }
    catch (err) {
      if (syncing.get(input.installationId) === run) syncing.delete(input.installationId);
      throw err;
    }
    assertCurrent();
    syncedAt.set(input.installationId, started);
  }
  return { sync, clear: () => { syncedAt.clear(); syncing.clear(); } };
}

function revisionFor(revisions: Map<string, Revision>, installationId: string): Revision {
  let revision = revisions.get(installationId);
  if (!revision) {
    revision = { publication: 0, preferences: 0, topics: new Map() };
    revisions.set(installationId, revision);
  }
  return revision;
}

function stalePreparation(prepared: Prepared, revision: Revision): boolean {
  return prepared.preferences !== revision.preferences
    || (revision.group?.key !== prepared.groupKey && (revision.group?.version ?? 0) > prepared.version)
    || prepared.topics.some(topic => (revision.topics.get(topic.topic) ?? 0) > prepared.version);
}

function beginPublication(revision: Revision, groupKey: string, topics: SenderFilterTopic[]): number {
  const version = ++revision.publication;
  for (const topic of topics) revision.topics.set(topic.topic, version);
  if (revision.group?.key !== groupKey) revision.group = { key: groupKey, version };
  return version;
}

async function queuePublication(
  pending: Map<string, Promise<PublicationResult>>, input: SenderFilterInput,
  signal: AbortSignal, update: (waited: boolean) => Promise<PublicationResult>,
): Promise<PublicationResult> {
  const previous = pending.get(input.installationId);
  const endQueue = input.timing?.phase('filter.queue');
  const run = (): Promise<PublicationResult> => { endQueue?.(); return abortable(update(previous !== undefined), signal); };
  const next = previous ? previous.then(run, run) : run();
  pending.set(input.installationId, next);
  const release = (): void => { if (pending.get(input.installationId) === next) pending.delete(input.installationId); };
  void next.then(release, release);
  try { return await abortable(next, signal); }
  finally { endQueue?.(); }
}

function fingerprint(groupKey: string, topic: SenderFilterTopic): string {
  return sha256(new TextEncoder().encode(JSON.stringify([groupKey, topic])));
}
