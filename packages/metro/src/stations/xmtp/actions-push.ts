/** XMTP push-token actions: register/list/test/unregister FCM device tokens. */

import { accounts } from './accounts.js';
import { respond } from './wire.js';
import { fcmPushToAll, loadPushTokens, savePushTokens, storePushToken } from './push.js';

type Args = Record<string, unknown>;
type Handler = (id: string, args: Args) => Promise<void>;

async function registerPush(id: string, args: Args): Promise<void> {
  const { token, account, platform, inboxId } = args as {
    token?: string; account?: string; platform?: string; inboxId?: string };
  if (!token || typeof token !== 'string' || token.length < 20) {
    throw new Error('register-push requires a non-empty FCM device token');
  }
  const total = storePushToken({ token, account, platform, inboxId });
  respond(id, { result: { stored: true, total, account: account ?? null } });
}

async function listPush(id: string): Promise<void> {
  const tokens = loadPushTokens();
  respond(id, { result: { count: tokens.length, tokens: tokens.map(t => ({
    token: `${t.token.slice(0, 12)}…${t.token.slice(-6)}`, registeredAt: t.registeredAt,
    lastSeenAt: t.lastSeenAt ?? null, account: t.account ?? null,
    platform: t.platform ?? null, inboxId: t.inboxId ?? null })) } });
}

async function testPush(id: string, args: Args): Promise<void> {
  const { account } = args as { account?: string };
  const acctId = account ?? (accounts.size === 1 ? [...accounts.keys()][0] : 'default');
  // Contentless test push (no plaintext); the device renders its generic card.
  await fcmPushToAll(acctId, { channelId: 'xmtp', source: 'test-push' });
  const sent = loadPushTokens().filter(t => !t.account || t.account === acctId).length;
  respond(id, { result: { sent, account: acctId } });
}

async function unregisterPush(id: string, args: Args): Promise<void> {
  const { token } = args as { token: string };
  savePushTokens(loadPushTokens().filter(t => t.token !== token));
  respond(id, { result: { removed: true } });
}

export const pushHandlers: Record<string, Handler> = {
  'register-push': registerPush,
  'list-push': (id) => listPush(id),
  'test-push': testPush,
  'unregister-push': unregisterPush,
};
