import type { Client } from '@xmtp/browser-sdk';
import { groupIdOfTopic, groupTopicOf, type HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import {
  makePushClear, makeTopicRefresh, runPushRegistration, runPushUnregistration, runSenderFilterPublication, toPermission, warmSenderFilterSync,
  type PushPermission, type PushTopics, type PushRuntimeInput,
} from './pushRegister.core';
import { dismissConvNotifications } from './pushNotify.web';
import { linkProxyBase } from './historyServer';
import { setPushStatus } from './pushStatus';
import { getCachedXmtpClient } from './xmtp.state.web';
import { getAccountEpoch } from './accountEpoch';
import { isBrowserExtension } from './extension.web';

function proxiedRpcUrl(method: string): string {
  return `${linkProxyBase()}/xmtp-push/${method}`;
}

type PushClient = Pick<Client<unknown>, 'installationId' | 'conversations' | 'preferences' | 'accountIdentifier' | 'inboxId' | 'signWithInstallationKey'>;

export function usePushDeepLinks(): void {
  return undefined;
}

export function isPushSupported(): boolean {
  return !isBrowserExtension() && typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export function getPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return Promise.resolve('denied');
  return Promise.resolve(toPermission(Notification.permission));
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'denied';
  try {
    return toPermission(await Notification.requestPermission());
  } catch { return 'undetermined'; }
}

async function webPushToken(): Promise<string | null> {
  if (!isPushSupported() || Notification.permission !== 'granted') return null;
  const { firebasePushToken } = await import('./firebaseWeb');
  return firebasePushToken();
}

async function collectTopics(client: PushClient, installationId: string): Promise<PushTopics> {
  const conversations = await client.conversations.list();
  const topics: string[] = [`/xmtp/mls/1/w-${installationId}/proto`];
  for (const conv of conversations) {
    const name = (conv as { name?: string }).name;
    if (!isSyncGroupName(name ?? '')) topics.push(groupTopicOf(conv.id));
  }
  return { topics, hmacKeys: normalizeKeys(await client.conversations.hmacKeys()) };
}

function normalizeKeys(keys: Awaited<ReturnType<PushClient['conversations']['hmacKeys']>>): HmacKeysByTopic {
  const hmacKeys: HmacKeysByTopic = {};
  for (const [id, list] of keys) {
    const topic = id.startsWith('/') ? id : groupTopicOf(id);
    hmacKeys[topic] = list.map((k) => ({ thirtyDayPeriodsSinceEpoch: Number(k.epoch), hmacKey: k.key }));
  }
  return hmacKeys;
}

async function collectSenderTopic(client: PushClient, topic: string): Promise<PushTopics> {
  const id = groupIdOfTopic(topic);
  const conv = id ? await client.conversations.getConversationById(id) : undefined;
  if (!conv) throw new Error('Sender filter conversation is not ready');
  return { topics: [topic], hmacKeys: normalizeKeys(await conv.hmacKeys()) };
}

function installationIdOf(client: PushClient): string | null {
  const id = client.installationId;
  if (typeof id === 'string' && id !== '') return id;
  setPushStatus('failed', 'the XMTP client has no installation id yet');
  return null;
}

function pushInput(client: PushClient): PushRuntimeInput | null {
  const installationId = installationIdOf(client);
  const accountAddress = client.accountIdentifier?.identifier;
  const inboxId = client.inboxId;
  if (!installationId || !accountAddress || !inboxId) return null;
  const epoch = getAccountEpoch();
  return {
    installationId,
    accountAddress,
    inboxId,
    signInstallation: text => client.signWithInstallationKey(text),
    current: () => getCachedXmtpClient() === client && getAccountEpoch() === epoch,
    syncPreferences: () => client.preferences.sync(),
    platform: 'web',
    rpcUrl: proxiedRpcUrl,
    getToken: webPushToken,
    collectTopics: () => collectTopics(client, installationId),
    collectSenderTopics: topic => topic ? collectSenderTopic(client, topic) : collectTopics(client, installationId),
  };
}

export async function registerPushWithServer(client: PushClient): Promise<void> {
  const input = pushInput(client);
  if (input) await runPushRegistration(input);
}

export async function prepareSenderFilters(client: PushClient, topic: string): Promise<void> {
  const input = pushInput(client);
  if (!input) throw new Error('Sender filter account is not ready');
  await runSenderFilterPublication(input, topic);
}

export async function warmSenderFilters(client: PushClient): Promise<void> {
  const input = pushInput(client);
  if (input) await warmSenderFilterSync(input);
}

export async function unregisterPushFromServer(client: PushClient): Promise<void> {
  const installationId = installationIdOf(client);
  if (installationId) await runPushUnregistration(installationId, proxiedRpcUrl);
}

export const schedulePushTopicRefresh = makeTopicRefresh(() => getCachedXmtpClient(), registerPushWithServer);

function cachedInstallationId(): string | null {
  const id = getCachedXmtpClient()?.installationId;
  return typeof id === 'string' && id !== '' ? id : null;
}

export const startPushClear = makePushClear({
  installationId: cachedInstallationId,
  rpcUrl: proxiedRpcUrl,
  dismissLocal: dismissConvNotifications,
});
