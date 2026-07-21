

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { appStorage } from '../platform/storage';
import type { Client } from '@xmtp/react-native-sdk';
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { ensureNotificationReady, getDeviceFcmToken } from './push.device';
import { getBridgeInboxAddress, buildRegisterPushBody } from './pushRegister.control';
import { isPushEnabledSync, loadPushEnabled } from './pushPref';

export { isMetroControlBody } from './pushRegister.control';
import { buildDisablePushBody } from './pushRegister.control';
export { usePushDeepLinks } from './pushRegister.deeplink';

const REGISTER_TTL_MS = 6 * 60 * 60 * 1000;
const lastRegisterKey = (account: string): string => `push.register.${account}`;

function platformTag(): 'android' | 'ios' | null {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  return null;
}

type PushClient = Pick<Client, 'inboxId' | 'publicIdentity' | 'conversations'>;

async function isRecentlyRegistered(stateKey: string, token: string): Promise<boolean> {
  const prev = await appStorage.get(stateKey).catch(() => null);
  if (!prev) return false;
  try {
    const { token: prevToken, at } = JSON.parse(prev) as { token: string; at: number };
    return prevToken === token && Date.now() - at < REGISTER_TTL_MS;
  } catch { return false; }
}

async function sendRegisterControlDm(
  client: PushClient,
  args: {
    bridgeInbox: string; token: string; platform: 'android' | 'ios';
    address: string; inboxId: string; stateKey: string;
  },
): Promise<void> {
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(args.bridgeInbox, 'ETHEREUM'),
  );
  const body = buildRegisterPushBody({
    token: args.token, platform: args.platform, address: args.address, inboxId: args.inboxId,
  });
  await dm.send(body);
  await appStorage.set(args.stateKey, JSON.stringify({ token: args.token, at: Date.now() }))
    .catch(() => undefined);
}

interface RegisterContext {
  platform: 'android' | 'ios';
  address: string;
  inboxId: string;
  token: string;
  stateKey: string;
}

async function resolveRegisterContext(client: PushClient): Promise<RegisterContext | null> {
  const platform = platformTag();
  if (!platform) return null;
  await loadPushEnabled();
  if (!isPushEnabledSync()) return null;
  const address = client.publicIdentity?.identifier;
  const inboxId = client.inboxId;
  if (!address || !inboxId) return null;
  const token = await getDeviceFcmToken();
  if (!token) return null;
  const stateKey = lastRegisterKey(address.toLowerCase());
  if (await isRecentlyRegistered(stateKey, token)) return null;
  return { platform, address, inboxId, token, stateKey };
}

export async function registerPushWithBridge(client: PushClient): Promise<void> {
  try {
    const bridgeInbox = getBridgeInboxAddress();
    if (!bridgeInbox) return;
    const ctx = await resolveRegisterContext(client);
    if (!ctx) return;
    await sendRegisterControlDm(client, { bridgeInbox, ...ctx });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('registerPushWithBridge failed', (err as Error).message);
    }
  }
}

async function loadRegisteredToken(account: string): Promise<string | null> {
  const prev = await appStorage.get(lastRegisterKey(account)).catch(() => null);
  await appStorage.delete(lastRegisterKey(account)).catch(() => undefined);
  if (!prev) return null;
  try { return (JSON.parse(prev) as { token?: string }).token ?? null; } catch { return null; }
}

export async function unregisterPushFromBridge(client: PushClient): Promise<void> {
  try {
    const bridgeInbox = getBridgeInboxAddress();
    if (!bridgeInbox) return;
    const address = client.publicIdentity?.identifier;
    const inboxId = client.inboxId;
    if (!address || !inboxId) return;
    const token = await loadRegisteredToken(address.toLowerCase());
    if (!token) return;
    const dm = await client.conversations.findOrCreateDmWithIdentity(
      new PublicIdentity(bridgeInbox, 'ETHEREUM'),
    );
    await dm.send(buildDisablePushBody({ token, address, inboxId }));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('unregisterPushFromBridge failed', (err as Error).message);
    }
  }
}

const bgDeliveredMsgIds = new Set<string>();
const BG_DELIVERED_MAX = 200;

export function markBackgroundDelivered(messageId: string | null | undefined): void {
  if (!messageId) return;
  bgDeliveredMsgIds.add(messageId);
  if (bgDeliveredMsgIds.size > BG_DELIVERED_MAX) {
    const oldest = bgDeliveredMsgIds.values().next().value;
    if (oldest !== undefined) bgDeliveredMsgIds.delete(oldest);
  }
}

function consumeBackgroundDelivered(messageId: string | undefined): boolean {
  if (!messageId) return false;
  return bgDeliveredMsgIds.delete(messageId);
}

export async function presentInboundNotification(args: {
  title: string;
  body: string;
  convId: string;
  messageId?: string;
}): Promise<void> {
  try {
    if (consumeBackgroundDelivered(args.messageId)) return;
    const ready = await ensureNotificationReady();
    if (!ready) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: 'default',
        data: { convId: args.convId, messageId: args.messageId ?? null, kind: 'xmtp-inbound' },
        ...(Platform.OS === 'android' ? { channelId: 'xmtp' } : {}),
      },
      trigger: null,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('presentInboundNotification failed', (err as Error).message);
    }
  }
}
