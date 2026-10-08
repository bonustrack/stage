import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import type { Client } from '@xmtp/react-native-sdk';
import { getAllPushTopics, getHmacKeys } from '@xmtp/react-native-sdk';
import { groupIdOfTopic, type HmacKeysByTopic, type PushPlatform } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { dismissConvNotifications, getDeviceFcmToken } from './pushNotify';
import { convIdOfNotificationData } from './pushNotify.model';
import {
  directRpcUrl, makePushClear, makeTopicRefresh, runPushRegistration, runPushUnregistration, runSenderFilterPublication, toPermission,
  warmSenderFilterSync,
  type PushPermission, type PushTopics, type PushRuntimeInput,
} from './pushRegister.core';
import { getCachedXmtpClient } from './xmtp.state';
import { getAccountEpoch } from './accountEpoch';
import { attempt, recover, reported } from './errorPolicy';

type PushClient = Pick<Client, 'installationId' | 'conversations' | 'preferences' | 'publicIdentity' | 'inboxId' | 'signWithInstallationKey'>;

const PLATFORM: PushPlatform = Platform.OS === 'android' ? 'android' : 'ios';

async function hiddenGroupIds(client: PushClient): Promise<Set<string>> {
  const hidden = new Set<string>();
  const groups = await client.conversations.listGroups().catch(recover('push.hiddenGroups', []));
  for (const group of groups) {
    const name = await group.name().catch(recover('push.hiddenGroups', ''));
    if (isSyncGroupName(name)) hidden.add(group.id.toLowerCase());
  }
  return hidden;
}

async function collectTopics(client: PushClient): Promise<PushTopics> {
  const all = await getAllPushTopics(client.installationId);
  const hidden = await hiddenGroupIds(client);
  const topics = all.filter((topic) => {
    const groupId = groupIdOfTopic(topic);
    return groupId === null || !hidden.has(groupId);
  });
  const keys = await getHmacKeys(client.installationId);
  const hmacKeys: HmacKeysByTopic = {};
  for (const [topic, entry] of Object.entries(keys.hmacKeys)) hmacKeys[topic] = entry.values;
  return { topics, hmacKeys };
}

function pushInput(client: PushClient): PushRuntimeInput {
  const epoch = getAccountEpoch();
  return {
    installationId: client.installationId,
    accountAddress: client.publicIdentity.identifier,
    inboxId: client.inboxId,
    signInstallation: text => client.signWithInstallationKey(text),
    current: () => getCachedXmtpClient() === client && getAccountEpoch() === epoch,
    syncPreferences: () => client.preferences.sync(),
    platform: PLATFORM,
    rpcUrl: directRpcUrl,
    getToken: getDeviceFcmToken,
    collectTopics: () => collectTopics(client),
    collectSenderTopics: async topic => {
      if (!topic) return collectTopics(client);
      const keys = await getHmacKeys(client.installationId);
      return { topics: [topic], hmacKeys: { [topic]: keys.hmacKeys[topic]?.values } };
    },
  };
}

export async function registerPushWithServer(client: PushClient): Promise<void> {
  await runPushRegistration(pushInput(client));
}

export async function prepareSenderFilters(client: PushClient, topic: string): Promise<void> {
  await runSenderFilterPublication(pushInput(client), topic);
}

export async function warmSenderFilters(client: PushClient): Promise<void> {
  await warmSenderFilterSync(pushInput(client));
}

export async function unregisterPushFromServer(client: PushClient): Promise<void> {
  await runPushUnregistration(client.installationId, directRpcUrl);
}

export const schedulePushTopicRefresh = makeTopicRefresh(() => getCachedXmtpClient(), registerPushWithServer);

export const startPushClear = makePushClear({
  installationId: () => getCachedXmtpClient()?.installationId ?? null,
  rpcUrl: directRpcUrl,
  dismissLocal: dismissConvNotifications,
});

export function isPushSupported(): boolean {
  return true;
}

export async function getPushPermission(): Promise<PushPermission> {
  try {
    return toPermission((await Notifications.getPermissionsAsync()).status);
  } catch { return 'undetermined'; }
}

export async function requestPushPermission(): Promise<PushPermission> {
  try {
    return toPermission((await Notifications.requestPermissionsAsync()).status);
  } catch { return 'undetermined'; }
}

const markConvRead = async (convId: string): Promise<void> => {
  const { markConvRead: fn } = await import('./channelsCache');
  return fn(convId);
};

function openConvFromResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const convId = convIdOfNotificationData(response.notification?.request?.content?.data);
  if (!convId) return;
  router.push({ pathname: '/channel/[convId]', params: { convId } });
  void markConvRead(convId).catch(reported('push.markRead'));
}

export function usePushDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (cancelled || !resp) return;
        attempt(() => { Notifications.clearLastNotificationResponse(); }, 'cleanup');
        openConvFromResponse(resp);
      })
      .catch(reported('push.lastResponse'));
    const sub = Notifications.addNotificationResponseReceivedListener(openConvFromResponse);
    return (): void => { cancelled = true; sub.remove(); };
  }, []);
}
