import type { Client } from '@xmtp/browser-sdk';
import { groupTopicOf, type HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import {
  makePushClear, makeTopicRefresh, runPushRegistration, runPushUnregistration, toPermission,
  type PushPermission, type PushTopics,
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

type PushClient = Pick<Client<unknown>, 'installationId' | 'conversations' | 'preferences' | 'accountIdentifier'>;

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
  const keys = await client.conversations.hmacKeys();
  const hmacKeys: HmacKeysByTopic = {};
  for (const [id, list] of keys) {
    const topic = id.startsWith('/') ? id : groupTopicOf(id);
    hmacKeys[topic] = list.map((k) => ({ thirtyDayPeriodsSinceEpoch: Number(k.epoch), hmacKey: k.key }));
  }
  return { topics, hmacKeys };
}

function installationIdOf(client: PushClient): string | null {
  const id = client.installationId;
  if (typeof id === 'string' && id !== '') return id;
  setPushStatus('failed', 'the XMTP client has no installation id yet');
  return null;
}

export async function registerPushWithServer(client: PushClient): Promise<void> {
  const installationId = installationIdOf(client);
  const accountAddress = client.accountIdentifier?.identifier;
  if (!installationId || !accountAddress) return;
  const epoch = getAccountEpoch();
  await runPushRegistration({
    installationId,
    accountAddress,
    current: () => getCachedXmtpClient() === client && getAccountEpoch() === epoch,
    syncPreferences: () => client.preferences.sync(),
    platform: 'web',
    rpcUrl: proxiedRpcUrl,
    getToken: webPushToken,
    collectTopics: () => collectTopics(client, installationId),
  });
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
