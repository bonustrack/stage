import { Platform } from 'react-native';
import type { Client } from '@xmtp/react-native-sdk';
import { getAllPushTopics, getHmacKeys } from '@xmtp/react-native-sdk';
import {
  PUSH_RPC, deleteInstallationBody, groupIdOfTopic, isWelcomeTopic, registerInstallationBody,
  subscribeWithMetadataBody, type HmacKeysByTopic, type PushPlatform,
} from '@stage-labs/client/xmtp/pushServer';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { getDeviceFcmToken } from './push.device';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';
import { setPushStatus } from './pushStatus';
import { getCachedXmtpClient } from './xmtp.state';

export { isMetroControlBody } from './pushRegister.control';
export { usePushDeepLinks } from './pushRegister.deeplink';

const SERVER_URL_ENV: unknown = process.env.EXPO_PUBLIC_PUSH_SERVER_URL;
const PUSH_SERVER_URL =
  typeof SERVER_URL_ENV === 'string' && SERVER_URL_ENV !== ''
    ? SERVER_URL_ENV.replace(/\/$/, '')
    : 'https://push.stage.box';

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;
const TOPIC_REFRESH_DEBOUNCE_MS = 1_500;
const stateKey = (installationId: string): string => `push.server.${installationId}`;

type PushClient = Pick<Client, 'installationId' | 'conversations'>;

interface RegisterState { token: string; at: number; topics: string }

function platformTag(): PushPlatform | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

function warn(label: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  setPushStatus('failed', message);
  if (process.env.NODE_ENV !== 'production') console.warn(label, message);
}

async function postJson(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${PUSH_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`push server ${path} responded ${res.status}`);
}

async function readState(key: string): Promise<RegisterState | null> {
  const raw = await appStorage.get(key).catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RegisterState>;
    if (typeof parsed.token !== 'string' || typeof parsed.at !== 'number') return null;
    return { token: parsed.token, at: parsed.at, topics: typeof parsed.topics === 'string' ? parsed.topics : '' };
  } catch { return null; }
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

async function subscribableTopics(client: PushClient): Promise<{ topics: string[]; hmacKeys: HmacKeysByTopic }> {
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

async function subscribeTopics(client: PushClient, prev: RegisterState | null, token: string, registeredAt: number): Promise<void> {
  const key = stateKey(client.installationId);
  const subs = await subscribableTopics(client);
  const signature = [...subs.topics].sort().join('\n');
  if (prev?.at === registeredAt && prev.topics === signature) {
    setPushStatus('registered', `${subs.topics.length} topics, unchanged`);
    return;
  }
  await postJson(
    PUSH_RPC.subscribe,
    subscribeWithMetadataBody(client.installationId, subs.topics, subs.hmacKeys, isWelcomeTopic),
  );
  const next: RegisterState = { token, at: registeredAt, topics: signature };
  await appStorage.set(key, JSON.stringify(next)).catch(() => undefined);
  setPushStatus('registered', `${subs.topics.length} topics`);
}

async function pushAllowed(): Promise<PushPlatform | null> {
  const platform = platformTag();
  if (!platform) {
    setPushStatus('unsupported');
    return null;
  }
  await loadPushEnabled();
  if (!isPushEnabledSync()) {
    setPushStatus('disabled');
    return null;
  }
  return platform;
}

export async function registerPushWithServer(client: PushClient): Promise<void> {
  try {
    const platform = await pushAllowed();
    if (!platform) return;
    const token = await getDeviceFcmToken();
    if (!token) {
      setPushStatus('no-token');
      return;
    }
    setPushStatus('registering');
    const prev = await readState(stateKey(client.installationId));
    const fresh = prev !== null && prev.token === token && Date.now() - prev.at < REGISTER_TTL_MS;
    if (!fresh) {
      await postJson(PUSH_RPC.register, registerInstallationBody(client.installationId, token, platform));
    }
    await subscribeTopics(client, fresh ? prev : null, token, fresh ? prev.at : Date.now());
  } catch (err) {
    warn('registerPushWithServer failed', err);
  }
}

export async function unregisterPushFromServer(client: PushClient): Promise<void> {
  try {
    const key = stateKey(client.installationId);
    const prev = await readState(key);
    await appStorage.delete(key).catch(() => undefined);
    setPushStatus('disabled');
    if (!prev) return;
    await postJson(PUSH_RPC.remove, deleteInstallationBody(client.installationId));
  } catch (err) {
    warn('unregisterPushFromServer failed', err);
  }
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
