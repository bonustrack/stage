import { errorMessage } from '@stage-labs/client/errors';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import {
  PUSH_RPC,
  clearConversationBody,
  derivePushGroupKey,
  deriveSenderFilterGroupKey,
  joinDeviceGroupBody,
  withoutSyncGroups,
} from '@stage-labs/client/xmtp/pushServer';
import { makePushRegistrar, type PushRegistrationInput, type PushTopics } from '@stage-labs/client/xmtp/pushRegistration';
import { makeSenderFilterPublisher, maintainPushPaths } from '@stage-labs/client/xmtp/pushSenderFilter';
import { timeSendPhase, type SendTiming } from '@stage-labs/client/xmtp/sendTiming';
import { fetchWithin } from '@stage-labs/client/timing';
import { appStorage } from '../platform/storage';
import { getActiveAccount } from './accounts';
import { AccountChangedError, clientScope, subscribeAccountChange, withAccountScope } from './accountSelection';
import { isAppInFront } from './appInFront';
import { onReadStateChanged } from './channelsCache';
import { report, reported, ignored } from './errorPolicy';
import { afterFirstPages } from './feed/firstPages';
import { PUSH_PLATFORM, dismissConvNotifications, pushRpcUrl, pushToken } from './pushNotify';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';
import { makePushRetry } from './pushRetry.core';
import { setPushStatus } from './pushStatus';
import { memoized } from './storeCore';
import { keyedTimers } from './writeBehind';
import { clientSdk, type XmtpClient } from './xmtp.clientSdk';
import { signingKeyForRecord } from './accountSigning';
import { getCachedXmtpClient } from './xmtp.state';

const CLEAR_DEBOUNCE_MS = 1_500;
const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;
const PUSH_POST_TIMEOUT_MS = 15_000;
const HTTP_CONFLICT = 409;

const stateKey = (installationId: string): string => `push.server.${installationId}`;
const joinedKey = (installationId: string): string => `push.group.${installationId}`;

interface PushRuntimeInput extends PushRegistrationInput {
  accountAddress: string;
  inboxId: string;
  signInstallation: (text: string) => Promise<Uint8Array>;
  collectSenderTopics: (topic?: string) => Promise<PushTopics>;
}

function reportPushFailure(scope: string, err: unknown): void {
  setPushStatus('failed', errorMessage(err));
  report(scope, err);
}

async function postJson(url: string, body: unknown, accepted?: number, signal?: AbortSignal): Promise<void> {
  const res = await fetchWithin(
    url,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    { timeoutMs: PUSH_POST_TIMEOUT_MS, signal },
  );
  if (!res.ok && res.status !== accepted) throw new Error(`push server responded ${res.status}`);
}

const groupKeys = new Map<string, Promise<string>>();
const senderGroupKeys = new Map<string, Promise<string>>();

function pushGroupKey(rec: AccountRecord): Promise<string> {
  return memoized(groupKeys, rec.address, () =>
    signingKeyForRecord(rec).then(({ signMessage }) => derivePushGroupKey(rec.address, signMessage)),
  );
}

function senderGroupKey(account: AccountRecord, inboxId: string): Promise<string> {
  return memoized(senderGroupKeys, `${account.address.toLowerCase()}:${inboxId}`, () =>
    signingKeyForRecord(account).then(({ signMessage }) => deriveSenderFilterGroupKey(account.address, inboxId, signMessage)),
  );
}

async function activeAccountFor(input: PushRuntimeInput): Promise<AccountRecord | null> {
  const account = await getActiveAccount();
  return account && account.address.toLowerCase() === input.accountAddress.toLowerCase() ? account : null;
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
  read: (installationId) => appStorage.get(stateKey(installationId)),
  write: (installationId, value) => appStorage.set(stateKey(installationId), value),
  remove: (installationId) => appStorage.delete(stateKey(installationId)),
  cacheError: reported('push.cache'),
  post: (url, body, signal) => postJson(url, body, undefined, signal),
  now: Date.now,
  status: setPushStatus,
});

const retry = makePushRetry((run, delay) => {
  const timer = setTimeout(run, delay);
  return () => {
    clearTimeout(timer);
  };
});

const senderPublisher = makeSenderFilterPublisher();

function installationIdOf(client: XmtpClient): string | null {
  const id = clientSdk.installationIdOf(client);
  if (typeof id === 'string' && id !== '') return id;
  setPushStatus('failed', 'the XMTP client has no installation id yet');
  return null;
}

async function collectTopics(client: XmtpClient): Promise<PushTopics> {
  const all = await clientSdk.push.topics(client);
  const topics = withoutSyncGroups(all, await clientSdk.push.groupNames(client));
  return { topics, hmacKeys: await clientSdk.push.hmacKeys(client) };
}

async function collectSenderTopics(client: XmtpClient, topic?: string): Promise<PushTopics> {
  if (!topic) return collectTopics(client);
  const keys = await clientSdk.push.hmacKeys(client, topic);
  return { topics: [topic], hmacKeys: { [topic]: keys[topic] } };
}

function pushInput(client: XmtpClient): PushRuntimeInput | null {
  const installationId = installationIdOf(client);
  const accountAddress = clientSdk.selfAddressOf(client);
  const inboxId = clientSdk.inboxIdOf(client);
  if (!installationId || !accountAddress || !inboxId) return null;
  return {
    installationId,
    accountAddress,
    inboxId,
    signInstallation: (text) => clientSdk.push.signWithInstallationKey(client, text),
    current: clientScope(client, getCachedXmtpClient).current,
    syncPreferences: () => clientSdk.syncPreferences(client),
    platform: PUSH_PLATFORM,
    rpcUrl: pushRpcUrl,
    getToken: pushToken,
    collectTopics: () => collectTopics(client),
    collectSenderTopics: (topic) => collectSenderTopics(client, topic),
  };
}

function publishSenderFilters(input: PushRuntimeInput, topic?: string, timing?: SendTiming): Promise<void> {
  return withAccountScope(async (scope) => {
    const current = (): boolean => scope.current() && input.current();
    const account = await timeSendPhase(timing, 'filter.account', () => activeAccountFor(input));
    if (!account || !current()) throw new AccountChangedError('Sender filter account changed');
    await senderPublisher.publish({
      installationId: input.installationId,
      current,
      signal: scope.signal,
      topic,
      timing,
      groupKey: () => senderGroupKey(account, input.inboxId),
      sign: input.signInstallation,
      syncPreferences: input.syncPreferences,
      collectTopics: input.collectSenderTopics,
      post: (body, signal) => postJson(input.rpcUrl(PUSH_RPC.senderFilters), body, undefined, signal),
    });
  });
}

async function pushEnabled(): Promise<boolean> {
  await loadPushEnabled();
  if (isPushEnabledSync()) return true;
  setPushStatus('disabled');
  return false;
}

async function registerDelivery(input: PushRuntimeInput, current: () => boolean, signal: AbortSignal): Promise<void> {
  if (!(await pushEnabled()) || !current()) return;
  const account = await activeAccountFor(input);
  if (!account || !current()) return;
  await afterFirstPages();
  const guarded = { ...input, current, signal };
  if (await registrar.register(guarded)) await joinDeviceGroup(guarded, account).catch(reported('push.join'));
}

function runPushRegistration(input: PushRuntimeInput): Promise<void> {
  return withAccountScope(async (scope) => {
    const accountCurrent = (): boolean => scope.current() && input.current();
    const current = (): boolean => accountCurrent() && isPushEnabledSync();
    try {
      if (!accountCurrent()) return;
      await maintainPushPaths(
        () => publishSenderFilters(input),
        () => registerDelivery(input, current, scope.signal),
      );
      if (accountCurrent()) retry.success(input.installationId);
    } catch (err) {
      if (!accountCurrent()) return;
      reportPushFailure('push.register', err);
      retry.failed(input.installationId, () => {
        if (input.current()) void runPushRegistration(input);
      });
    }
  });
}

export async function registerPushWithServer(client: XmtpClient): Promise<void> {
  const input = pushInput(client);
  if (input) await runPushRegistration(input);
}

export async function registerCachedClientPush(): Promise<void> {
  const client = getCachedXmtpClient();
  if (client) await registerPushWithServer(client);
}

export async function prepareSenderFilters(client: XmtpClient, topic: string, timing?: SendTiming): Promise<void> {
  const input = pushInput(client);
  if (!input) throw new Error('Sender filter account is not ready');
  await publishSenderFilters(input, topic, timing);
}

export function warmSendPath(): void {
  const client = getCachedXmtpClient();
  if (!client || !isAppInFront()) return;
  const input = pushInput(client);
  if (input) void senderPublisher.warm(input).catch(ignored(undefined, 'optional'));
}

export async function unregisterPushFromServer(client: XmtpClient): Promise<void> {
  const installationId = installationIdOf(client);
  if (!installationId) return;
  try {
    retry.success(installationId);
    setPushStatus('disabled');
    await registrar.unregister(installationId, pushRpcUrl);
  } catch (err) {
    reportPushFailure('push.unregister', err);
  }
}

const pushTimers = keyedTimers();
const TOPIC_REFRESH = 'topics';
let topicRefreshDueAt = 0;

export function schedulePushTopicRefresh(delayMs = TOPIC_REFRESH_DEBOUNCE_MS): void {
  topicRefreshDueAt = Math.max(topicRefreshDueAt, Date.now() + delayMs);
  pushTimers.schedule(TOPIC_REFRESH, topicRefreshDueAt - Date.now(), () => {
    topicRefreshDueAt = 0;
    const client = getCachedXmtpClient();
    if (client) void registerPushWithServer(client);
  });
}

function cachedInstallationId(): string | null {
  const client = getCachedXmtpClient();
  const id = client ? clientSdk.installationIdOf(client) : undefined;
  return typeof id === 'string' && id !== '' ? id : null;
}

async function requestPushClear(convId: string): Promise<void> {
  const installationId = cachedInstallationId();
  if (installationId === null) return;
  const account = await getActiveAccount();
  if (account === null || cachedInstallationId() !== installationId) return;
  const groupKey = await pushGroupKey(account);
  if (cachedInstallationId() !== installationId) return;
  await postJson(pushRpcUrl(PUSH_RPC.clear), clearConversationBody(installationId, groupKey, convId));
}

function clearOnRead(convId: string): void {
  void dismissConvNotifications(convId).catch(ignored(undefined, 'ui'));
  pushTimers.schedule(`clear:${convId}`, CLEAR_DEBOUNCE_MS, () => {
    void requestPushClear(convId).catch(reported('push.clear'));
  });
}

function forgetAccountPushState(): void {
  retry.clear();
  senderPublisher.clear();
  senderGroupKeys.clear();
}

let started = false;

export function startPush(): void {
  if (started) return;
  started = true;
  subscribeAccountChange(forgetAccountPushState);
  onReadStateChanged(({ convId, markedUnread }) => {
    if (!markedUnread) clearOnRead(convId);
  });
}
