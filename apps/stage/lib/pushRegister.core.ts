import { errorMessage } from '@stage-labs/client/errors';
import {
  PUSH_RPC, clearConversationBody, derivePushGroupKey, deriveSenderFilterGroupKey, joinDeviceGroupBody, pushRpcPath, type PushRpc,
} from '@stage-labs/client/xmtp/pushServer';
import { appStorage } from '../platform/storage';
import { getActiveAccount, type AccountRecord } from './accounts';
import { makePushRegistrar, type PushRegistrationInput, type PushTopics } from './pushRegistration.core';
import { subscribeAccountEpoch } from './accountEpoch';
import { subscribeAccountSelection } from './accountSelection';
import { makePushRetry } from './pushRetry.core';
import { makeSenderFilterPublisher, maintainPushPaths } from './pushSenderFilter.core';

export type { PushTopics } from './pushRegistration.core';
import { onReadStateChanged } from './channelsCache';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';
import { setPushStatus } from './pushStatus';
import { report, reported, ignored } from './errorPolicy';
import { afterFirstPages } from './feedLines';
import { envBaseUrl } from './env';
import { signingKeyForRecord } from './xmtp.signing.core';

const PUSH_SERVER_URL = envBaseUrl(process.env.EXPO_PUBLIC_PUSH_SERVER_URL, 'https://push.stage.box');
const CLEAR_DEBOUNCE_MS = 1_500;
const HTTP_CONFLICT = 409;

const stateKey = (installationId: string): string => `push.server.${installationId}`;
const joinedKey = (installationId: string): string => `push.group.${installationId}`;

export type PushPermission = 'granted' | 'denied' | 'undetermined';

const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;

export function toPermission(status: string): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export function makeTopicRefresh<C>(
  getClient: () => C | null | undefined, register: (client: C) => Promise<void>, now = Date.now,
): (delayMs?: number) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dueAt = 0;
  return (delayMs = TOPIC_REFRESH_DEBOUNCE_MS) => {
    if (timer) clearTimeout(timer);
    dueAt = Math.max(dueAt, now() + delayMs);
    timer = setTimeout(() => {
      timer = null;
      dueAt = 0;
      const client = getClient();
      if (client) void register(client);
    }, dueAt - now());
  };
}

function reportPushFailure(scope: string, err: unknown): void {
  setPushStatus('failed', errorMessage(err));
  report(scope, err);
}

export function directRpcUrl(method: PushRpc): string {
  return `${PUSH_SERVER_URL}${pushRpcPath(method)}`;
}

async function postJson(url: string, body: unknown, accepted?: number, signal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const abort = (): void => { controller.abort(); };
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15_000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== accepted) throw new Error(`push server responded ${res.status}`);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

const groupKeys = new Map<string, Promise<string>>();

async function pushGroupKey(rec: AccountRecord): Promise<string> {
  const known = groupKeys.get(rec.address);
  if (known) return known;
  const pending = signingKeyForRecord(rec).then(({ signMessage }) => derivePushGroupKey(rec.address, signMessage));
  groupKeys.set(rec.address, pending);
  pending.catch(() => { groupKeys.delete(rec.address); });
  return pending;
}

async function joinDeviceGroup(input: PushRegistrationInput, account: AccountRecord): Promise<void> {
  const key = joinedKey(input.installationId);
  if ((await appStorage.get(key)) === '1' || !input.current()) return;
  const groupKey = await pushGroupKey(account);
  if (!input.current()) return;
  await postJson(input.rpcUrl(PUSH_RPC.join), joinDeviceGroupBody(input.installationId, groupKey), HTTP_CONFLICT);
  await appStorage.set(key, '1').catch(ignored(undefined, 'cache'));
}

const registrar = makePushRegistrar({
  read: installationId => appStorage.get(stateKey(installationId)),
  write: (installationId, value) => appStorage.set(stateKey(installationId), value),
  remove: installationId => appStorage.delete(stateKey(installationId)),
  cacheError: reported('push.cache'),
  post: (url, body, signal) => postJson(url, body, undefined, signal),
  now: Date.now,
  status: setPushStatus,
});

const retry = makePushRetry((run, delay) => {
  const timer = setTimeout(run, delay);
  return () => { clearTimeout(timer); };
});
subscribeAccountEpoch(retry.clear);
subscribeAccountSelection(retry.clear);

async function pushEnabled(): Promise<boolean> {
  await loadPushEnabled();
  if (isPushEnabledSync()) return true;
  setPushStatus('disabled');
  return false;
}

export interface PushRuntimeInput extends PushRegistrationInput {
  accountAddress: string;
  inboxId: string;
  signInstallation: (text: string) => Promise<Uint8Array>;
  collectSenderTopics: (topic?: string) => Promise<PushTopics>;
}

const senderPublisher = makeSenderFilterPublisher();
const senderGroupKeys = new Map<string, Promise<string>>();
function clearSenderState(): void { senderPublisher.clear(); senderGroupKeys.clear(); }
subscribeAccountEpoch(clearSenderState);
subscribeAccountSelection(clearSenderState);

async function senderGroupKey(account: AccountRecord, inboxId: string): Promise<string> {
  const id = `${account.address.toLowerCase()}:${inboxId}`;
  const known = senderGroupKeys.get(id);
  if (known) return known;
  const pending = signingKeyForRecord(account).then(({ signMessage }) => deriveSenderFilterGroupKey(account.address, inboxId, signMessage));
  senderGroupKeys.set(id, pending);
  pending.catch(() => { senderGroupKeys.delete(id); });
  return pending;
}

export async function runSenderFilterPublication(input: PushRuntimeInput, topic?: string): Promise<void> {
  const controller = new AbortController();
  const abort = (): void => { controller.abort(); };
  const stopEpoch = subscribeAccountEpoch(abort);
  const stopSelection = subscribeAccountSelection(abort);
  const current = (): boolean => !controller.signal.aborted && input.current();
  try {
    const account = await getActiveAccount();
    if (!account || account.address.toLowerCase() !== input.accountAddress.toLowerCase() || !current()) throw new Error('Sender filter account changed');
    await senderPublisher.publish({
      installationId: input.installationId, current, signal: controller.signal, topic,
      groupKey: () => senderGroupKey(account, input.inboxId), sign: input.signInstallation,
      syncPreferences: input.syncPreferences, collectTopics: input.collectSenderTopics,
      post: (body, signal) => postJson(input.rpcUrl(PUSH_RPC.senderFilters), body, undefined, signal),
    });
  } finally { stopEpoch(); stopSelection(); }
}

export async function warmSenderFilterSync(input: PushRuntimeInput): Promise<void> {
  await senderPublisher.warm(input);
}

export async function runPushRegistration(input: PushRuntimeInput): Promise<void> {
  const controller = new AbortController();
  const abort = (): void => { controller.abort(); };
  const stopEpoch = subscribeAccountEpoch(abort);
  const stopSelection = subscribeAccountSelection(abort);
  const accountCurrent = (): boolean => !controller.signal.aborted && input.current();
  const current = (): boolean => accountCurrent() && isPushEnabledSync();
  try {
    if (!accountCurrent()) return;
    await maintainPushPaths(
      () => runSenderFilterPublication(input),
      () => registerDelivery(input, current, controller.signal),
    );
    if (accountCurrent()) retry.success(input.installationId);
  } catch (err) {
    if (accountCurrent()) {
      reportPushFailure('push.register', err);
      retry.failed(input.installationId, () => { if (input.current()) void runPushRegistration(input); });
    }
  } finally { stopEpoch(); stopSelection(); }
}

async function registerDelivery(input: PushRuntimeInput, current: () => boolean, signal: AbortSignal): Promise<void> {
  if (!(await pushEnabled()) || !current()) return;
  const account = await getActiveAccount();
  if (!account || account.address.toLowerCase() !== input.accountAddress.toLowerCase() || !current()) return;
  await afterFirstPages();
  const guarded = { ...input, current, signal };
  if (await registrar.register(guarded)) await joinDeviceGroup(guarded, account).catch(reported('push.join'));
}

export async function runPushUnregistration(installationId: string, rpcUrl: (method: PushRpc) => string): Promise<void> {
  try {
    retry.success(installationId);
    setPushStatus('disabled');
    await registrar.unregister(installationId, rpcUrl);
  } catch (err) {
    reportPushFailure('push.unregister', err);
  }
}

interface PushClearInput {
  installationId: () => string | null;
  rpcUrl: (method: PushRpc) => string;
  dismissLocal: (convId: string) => Promise<void>;
}

async function requestPushClear(input: PushClearInput, convId: string): Promise<void> {
  const installationId = input.installationId();
  if (installationId === null) return;
  const account = await getActiveAccount();
  if (account === null || input.installationId() !== installationId) return;
  const groupKey = await pushGroupKey(account);
  if (input.installationId() !== installationId) return;
  await postJson(input.rpcUrl(PUSH_RPC.clear), clearConversationBody(installationId, groupKey, convId));
}

export function makePushClear(input: PushClearInput): () => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  let started = false;
  return () => {
    if (started) return;
    started = true;
    onReadStateChanged(({ convId, markedUnread }) => {
      if (markedUnread) return;
      void input.dismissLocal(convId).catch(ignored(undefined, 'ui'));
      const timer = pending.get(convId);
      if (timer !== undefined) clearTimeout(timer);
      pending.set(convId, setTimeout(() => {
        pending.delete(convId);
        void requestPushClear(input, convId).catch(reported('push.clear'));
      }, CLEAR_DEBOUNCE_MS));
    });
  };
}
