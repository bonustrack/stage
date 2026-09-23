import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Client } from '@xmtp/react-native-sdk';
import { getAllPushTopics, getHmacKeys } from '@xmtp/react-native-sdk';
import { groupIdOfTopic, type HmacKeysByTopic, type PushPlatform } from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { getDeviceFcmToken } from './push.device';
import {
  directRpcUrl, makeTopicRefresh, runPushRegistration, runPushUnregistration, toPermission,
  type PushPermission, type PushTopics,
} from './pushRegister.core';
import { setPushStatus } from './pushStatus';
import { getCachedXmtpClient } from './xmtp.state';
import { recover } from './errorPolicy';

export { usePushDeepLinks } from './pushRegister.deeplink';

type PushClient = Pick<Client, 'installationId' | 'conversations'>;

function platformTag(): PushPlatform | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

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

export async function registerPushWithServer(client: PushClient): Promise<void> {
  const platform = platformTag();
  if (!platform) {
    setPushStatus('unsupported');
    return;
  }
  await runPushRegistration({
    installationId: client.installationId,
    platform,
    rpcUrl: directRpcUrl,
    getToken: getDeviceFcmToken,
    collectTopics: () => collectTopics(client),
  });
}

export async function unregisterPushFromServer(client: PushClient): Promise<void> {
  await runPushUnregistration(client.installationId, directRpcUrl);
}

const refreshTopics = makeTopicRefresh(() => getCachedXmtpClient(), registerPushWithServer);

export function schedulePushTopicRefresh(): void {
  if (platformTag() === null) return;
  refreshTopics();
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
