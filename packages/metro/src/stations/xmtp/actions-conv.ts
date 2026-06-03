/** XMTP conversation + push-token actions (newDm/newGroup/query/…/*-push). */

import { IdentifierKind } from '@xmtp/node-sdk';
import { accounts, accountForCall, convOf, lineOf, parseLine, type Account } from './accounts.js';
import { inboxEthCache, respond } from './wire.js';
import { warmGroupName } from './conv-name.js';
import { pushHandlers } from './actions-push.js';
import { cleanLabels, labelsBlob, readAppData, type GroupLike } from './labels.js';
import { closeGroup } from './actions-close.js';
import { setGithub } from './actions-github.js';
import { updateChannelMeta, applyChannelMeta, resolveLine } from './actions-meta.js';

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
  warmGroupName(group.id, name);
  respond(id, { result: { line: lineOf(acct.cfg.id, group.id), id: group.id, account: acct.cfg.id } });
}

/** Create a "request" group (name + description + status label + members) in ONE
 *  createGroup call. Members: Ethereum addrs (memberAddresses) and/or XMTP inboxIds
 *  (memberInboxIds); at least one required (default = Less). */
async function createRequestGroup(id: string, args: Args): Promise<void> {
  const { memberAddresses, memberInboxIds, name, description, labels } = args as {
    memberAddresses?: string[]; memberInboxIds?: string[];
    name: string; description?: string; labels?: string[] };
  const acct = accountForCall(args as { account?: string });
  if (!name || typeof name !== 'string') throw new Error('createRequestGroup requires a `name`');
  const addrs = (memberAddresses ?? []).filter(a => typeof a === 'string' && a.length > 0);
  const inboxes = (memberInboxIds ?? []).filter(a => typeof a === 'string' && a.length > 0);
  if (addrs.length === 0 && inboxes.length === 0) {
    throw new Error('createRequestGroup requires memberAddresses[] or memberInboxIds[]');
  }
  const opts: { groupName: string; groupDescription?: string; appData?: string } = { groupName: name };
  if (description) opts.groupDescription = description;
  if (Array.isArray(labels) && labels.length) opts.appData = labelsBlob(undefined, labels);

  let group: GroupLike;
  if (addrs.length) {
    // createGroupWithIdentifiers takes the Ethereum identifiers; any inboxId-only
    // members are added after via addMembers (node-sdk Group.addMembers(inboxIds)).
    const created = await acct.client.conversations.createGroupWithIdentifiers(
      addrs.map(a => ({ identifier: a, identifierKind: IdentifierKind.Ethereum })),
      opts as unknown as Parameters<typeof acct.client.conversations.createGroupWithIdentifiers>[1]);
    group = created as unknown as GroupLike;
    if (inboxes.length) {
      await (created as unknown as { addMembers: (ids: string[]) => Promise<unknown> }).addMembers(inboxes);
    }
  } else {
    // inboxId-only path: createGroup(inboxIds, options).
    const created = await acct.client.conversations.createGroup(
      inboxes, opts as unknown as Parameters<typeof acct.client.conversations.createGroup>[1]);
    group = created as unknown as GroupLike;
  }

  warmGroupName(group.id, name);
  respond(id, { result: {
    line: lineOf(acct.cfg.id, group.id), id: group.id, account: acct.cfg.id,
    name, description: description ?? '', labels: cleanLabels(labels ?? []) } });
}

/** Update a group's status labels (and optionally name/description/github). Thin
 *  wrapper over applyChannelMeta — merges {v:1, labels, github?} into appData. */
async function setLabels(id: string, args: Args): Promise<void> {
  const { labels, setName, setDescription, setGithub } = args as {
    line?: string; groupId?: string; labels: string[];
    setName?: string; setDescription?: string; setGithub?: string };
  const resolvedLine = resolveLine(args, 'setLabels');
  if (!Array.isArray(labels)) throw new Error('setLabels requires a `labels` array');
  const appData: Record<string, unknown> = { labels };
  if (typeof setGithub === 'string') appData['github'] = setGithub;
  const result = await applyChannelMeta(
    { line: resolvedLine, name: setName, description: setDescription, appData }, 'setLabels');
  respond(id, { result: {
    line: result['line'], id: result['id'], account: result['account'], labels: result['labels'] } });
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
  // Readback: parse the labels + github we own out of the group's appData.
  const { labels, github } = readAppData((conv as unknown as GroupLike).appData);
  respond(id, { result: { line, id: conv.id, account: acct.cfg.id, version: isDm ? 'dm' : 'group',
    name: resolvedName ?? '', memberCount: inboxIds.length, labels, github,
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

export const convHandlers: Record<string, Handler> = {
  newDm, newGroup, createRequestGroup, setLabels, setGithub, updateChannelMeta, closeGroup, query, groupInfo, listConvs,
  ...pushHandlers,
};
