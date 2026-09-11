import type { Client } from '@xmtp/browser-sdk';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import type { HmacKeysByTopic } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { FIREBASE_WEB_CONFIG, firebaseWebConfigured } from './firebaseWeb';
import { runPushRegistration, runPushUnregistration, type PushTopics } from './pushRegister.core';
import { linkProxyBase } from './historyServer';
import { setPushStatus } from './pushStatus';
import { getCachedXmtpClient } from './xmtp.state.web';

export { isMetroControlBody } from './pushRegister.control';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export const PUSH_SERVICE_WORKER_PATH = '/push-sw.js';

function proxiedRpcUrl(method: string): string {
  return `${linkProxyBase()}/xmtp-push/${method}`;
}
const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;

type PushClient = Pick<Client<unknown>, 'installationId' | 'conversations'>;

export function usePushDeepLinks(): void {
  return undefined;
}

function notificationsAvailable(): boolean {
  return typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function toPermission(value: string): PushPermission {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  return 'undetermined';
}

export function getPushPermission(): Promise<PushPermission> {
  if (!notificationsAvailable()) return Promise.resolve('denied');
  return Promise.resolve(toPermission(Notification.permission));
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!notificationsAvailable()) return 'denied';
  try {
    return toPermission(await Notification.requestPermission());
  } catch { return 'undetermined'; }
}

async function webPushToken(): Promise<string | null> {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return null;
  if (!firebaseWebConfigured()) throw new Error('web push is not configured in this build');
  if (!(await isSupported())) throw new Error('this browser does not support web push');
  const registration = await navigator.serviceWorker.register(PUSH_SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;
  const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_WEB_CONFIG);
  return getToken(getMessaging(app), {
    vapidKey: FIREBASE_WEB_CONFIG.vapidPublicKey, serviceWorkerRegistration: registration,
  });
}

function groupTopic(groupId: string): string {
  return `/xmtp/mls/1/g-${groupId}/proto`;
}

async function collectTopics(client: PushClient, installationId: string): Promise<PushTopics> {
  const conversations = await client.conversations.list();
  const topics: string[] = [`/xmtp/mls/1/w-${installationId}/proto`];
  for (const conv of conversations) {
    const name = (conv as { name?: string }).name;
    if (!isSyncGroupName(name ?? '')) topics.push(groupTopic(conv.id));
  }
  const keys = await client.conversations.hmacKeys();
  const hmacKeys: HmacKeysByTopic = {};
  for (const [id, list] of keys) {
    const topic = id.startsWith('/') ? id : groupTopic(id);
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
  if (!installationId) return;
  await runPushRegistration({
    installationId,
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

let topicRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePushTopicRefresh(): void {
  if (topicRefreshTimer) clearTimeout(topicRefreshTimer);
  topicRefreshTimer = setTimeout(() => {
    topicRefreshTimer = null;
    const client = getCachedXmtpClient();
    if (client) void registerPushWithServer(client);
  }, TOPIC_REFRESH_DEBOUNCE_MS);
}
