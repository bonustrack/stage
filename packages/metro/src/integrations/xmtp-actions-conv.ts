/** XMTP conversation + push-token actions (newDm/newGroup/query/…/*-push). */

import { IdentifierKind } from '@xmtp/node-sdk';
import { accounts, accountForCall, convOf, lineOf, parseLine, type Account } from './xmtp-accounts.js';
import { inboxEthCache, respond } from './xmtp-wire.js';
import { fcmPushToAll, loadPushTokens, savePushTokens, storePushToken } from './xmtp-push.js';

type Args = Record<string, unknown>;
type Handler = (id: string, args: Args) => Promise<void>;

async function newDm(id: string, args: Args): Promise<void> {
  const { address } = args as { address: string };
  const acct = accountForCall(args as { account?: string });
  const dm = await acct.client.conversations.createDmWithIdentifier({
    identifier: address, identifierKind: IdentifierKind.Ethereum });
  respond(id, { result: { line: lineOf(acct.cfg.id, dm.id), id: dm.id, account: acct.cfg.id } });
}

async function newGroup(id: string, args: Args): Promise<void> {
  const { addresses, name, permissions } = args as {
    addresses: string[]; name?: string; permissions?: 'admin-only' | 'default' };
  const acct = accountForCall(args as { account?: string });
  const opts: { groupName?: string; permissions?: number } = {};
  if (name) opts.groupName = name;
  if (permissions === 'admin-only') opts.permissions = 1;
  const group = await acct.client.conversations.createGroupWithIdentifiers(
    addresses.map(a => ({ identifier: a, identifierKind: IdentifierKind.Ethereum })), opts);
  respond(id, { result: { line: lineOf(acct.cfg.id, group.id), id: group.id, account: acct.cfg.id } });
}

async function query(id: string, args: Args): Promise<void> {
  const { line, limit } = args as { line: string; limit?: number };
  const { conv } = await convOf(line);
  if (!conv) throw new Error(`conversation not found for ${line}`);
  const lim = Math.min(Math.max(1, limit ?? 20), 200);
  await conv.sync().catch(() => undefined);
  const all = await conv.messages();
  const slice = all.slice(-lim);
  const acctId = parseLine(line)!.accountId;
  const messages = slice.map(m => {
    let text = '';
    try { const cc: unknown = m.content; text = typeof cc === 'string' ? cc : `[${m.contentType?.typeId ?? 'unknown'}]`; }
    catch { text = `[${m.contentType?.typeId ?? 'unknown'}]`; }
    return { id: m.id, ts: new Date(Number(m.sentAtNs / 1_000_000n)).toISOString(),
      from: `metro://xmtp/${acctId}/user/${m.senderInboxId}`, text, contentType: m.contentType?.typeId ?? 'unknown' };
  });
  respond(id, { result: { line, count: messages.length, messages } });
}

async function groupInfo(id: string, args: Args): Promise<void> {
  const { line } = args as { line: string };
  const { acct, conv } = await convOf(line);
  if (!conv) throw new Error(`conversation not found for ${line}`);
  const inboxIds = (await conv.members()).map(m => m.inboxId);
  const addresses: Record<string, string> = {};
  /** #9: serve cached inbox→eth first; only fetch states for the misses. */
  const missing = inboxIds.filter(iid => {
    const cached = inboxEthCache.get(iid);
    if (cached) { addresses[iid] = cached; return false; }
    return true;
  });
  if (missing.length) {
    try {
      const states = await acct.client.preferences.fetchInboxStates(missing);
      for (let i = 0; i < missing.length; i++) {
        const eth = states[i]?.identifiers.find(
          (it: { identifierKind: IdentifierKind }) => it.identifierKind === IdentifierKind.Ethereum);
        if (eth?.identifier) {
          addresses[missing[i]!] = eth.identifier;
          inboxEthCache.set(missing[i]!, eth.identifier);
        }
      }
    } catch { /* best-effort */ }
  }
  const isDm = typeof (conv as unknown as { peerInboxId?: unknown }).peerInboxId === 'function';
  const groupName = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
  const resolvedName = typeof groupName === 'function' ? await groupName() : (groupName ?? '');
  respond(id, { result: { line, id: conv.id, account: acct.cfg.id, version: isDm ? 'dm' : 'group',
    name: resolvedName ?? '', memberCount: inboxIds.length,
    members: inboxIds.map(iid => ({ inboxId: iid, address: addresses[iid] ?? null })) } });
}

async function summarizeConv(acct: Account, c: Awaited<ReturnType<typeof convOf>>['conv'] & object): Promise<unknown> {
  /** #9: bounded — fetch only the newest message instead of the whole history. */
  const recent = await c.messages({ limit: 1, direction: 1 } as Parameters<typeof c.messages>[0]).catch(() => []);
  const last = recent[0];
  let preview = '';
  if (last) {
    const cc: unknown = last.content;
    preview = typeof cc === 'string' ? cc.slice(0, 80) : `[${last.contentType?.typeId ?? 'unknown'}]`;
  }
  const isDm = typeof (c as unknown as { peerInboxId?: unknown }).peerInboxId === 'function';
  const gn = (c as unknown as { name?: string | (() => Promise<string>) }).name;
  const resolvedName = typeof gn === 'function' ? await gn().catch(() => '') : (gn ?? '');
  return { line: lineOf(acct.cfg.id, c.id), id: c.id, account: acct.cfg.id,
    version: isDm ? 'dm' : 'group', name: resolvedName ?? '',
    lastTs: last ? new Date(Number(last.sentAtNs / 1_000_000n)).toISOString() : null, lastPreview: preview };
}

async function listConvs(id: string, args: Args): Promise<void> {
  const { limit, account } = args as { limit?: number; account?: string };
  const lim = Math.min(Math.max(1, limit ?? 50), 200);
  const targets = account ? [accounts.get(account)!].filter(Boolean) : [...accounts.values()];
  const summaries: unknown[] = [];
  for (const acct of targets) {
    await acct.client.conversations.syncAll();
    const all = await acct.client.conversations.list();
    for (const c of all.slice(0, lim)) summaries.push(await summarizeConv(acct, c as object & typeof c));
  }
  summaries.sort((a, b) =>
    ((b as { lastTs?: string }).lastTs ?? '').localeCompare((a as { lastTs?: string }).lastTs ?? ''));
  respond(id, { result: { count: summaries.length, conversations: summaries.slice(0, lim) } });
}

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

export const convHandlers: Record<string, Handler> = {
  newDm, newGroup, query, groupInfo, listConvs,
  'register-push': registerPush,
  'list-push': (id) => listPush(id),
  'test-push': testPush,
  'unregister-push': unregisterPush,
};
