import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Client } from '@xmtp/react-native-sdk';
import { getAllPushTopics, getHmacKeys } from '@xmtp/react-native-sdk';
import { groupIdOfTopic, type HmacKeysByTopic, type PushPlatform } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { getDeviceFcmToken } from './push.device';
import { runPushRegistration, runPushUnregistration, type PushTopics } from './pushRegister.core';
import { setPushStatus } from './pushStatus';
import { getCachedXmtpClient } from './xmtp.state';

export { isMetroControlBody } from './pushRegister.control';
export { usePushDeepLinks } from './pushRegister.deeplink';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;

type PushClient = Pick<Client, 'installationId' | 'conversations'>;

function platformTag(): PushPlatform | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

async function hiddenGroupIds(client: PushClient): Promise<Set<string>> {
  const hidden = new Set<string>();
  const groups = await client.conversations.listGroups().catch(() => []);
  for (const group of groups) {
    const name = await group.name().catch(() => '');
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

export async function registerPushWithServer(client: PushClient): Promise<void> {
  const platform = platformTag();
  if (!platform) {
    setPushStatus('unsupported');
    return;
  }
  await runPushRegistration({
    installationId: client.installationId,
    platform,
    getToken: getDeviceFcmToken,
    collectTopics: () => collectTopics(client),
  });
}

export async function unregisterPushFromServer(client: PushClient): Promise<void> {
  await runPushUnregistration(client.installationId);
}

let topicRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePushTopicRefresh(): void {
  if (platformTag() === null) return;
  if (topicRefreshTimer) clearTimeout(topicRefreshTimer);
  topicRefreshTimer = setTimeout(() => {
    topicRefreshTimer = null;
    const client = getCachedXmtpClient();
    if (client) void registerPushWithServer(client);
  }, TOPIC_REFRESH_DEBOUNCE_MS);
}

function toPermission(status: string): PushPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
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
