/** Themed porcelain verbs for conversations: `channel`, `group`, `dm`. Each is a
 *  thin wrapper over an existing xmtp train action via the unchanged forward-call
 *  path, adding only the uniform envelope/--quiet/exit codes (see verbs.ts). */

import { loadMetroEnv } from '../paths.js';
import { exitErr, flagOne, type Flags } from './util.js';
import { EXIT, forwardCall, requireArg, runVerb } from './verbs.js';

/** `metro channel <set-github|set-labels|meta|info> <line> [flags]` */
export async function cmdChannel(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const sub = p[0];
  if (sub === 'set-github') return channelSetGithub(p.slice(1), f);
  if (sub === 'set-labels') return channelSetLabels(p.slice(1), f);
  if (sub === 'meta') return channelMeta(p.slice(1), f);
  if (sub === 'info') return channelInfo(p.slice(1), f);
  throw exitErr('usage: metro channel <set-github|set-labels|meta|info> <line> [flags]', EXIT.usage);
}

async function channelSetGithub(p: string[], f: Flags): Promise<void> {
  const line = requireArg(p, 0, 'metro channel set-github <line> <url|->');
  // url is the next positional, or '' to clear.
  const url = p[1] ?? '';
  await runVerb('channel.set-github', f,
    () => forwardCall('xmtp', 'setGithub', { line, url }),
    r => `set github on ${line} → ${(r as Record<string, unknown>)?.['github'] ?? '(cleared)'}`);
}

async function channelSetLabels(p: string[], f: Flags): Promise<void> {
  const line = requireArg(p, 0, 'metro channel set-labels <line> <label,label,…>');
  const raw = p[1] ?? flagOne(f, 'labels') ?? '';
  const labels = raw.split(',').map(s => s.trim()).filter(Boolean);
  await runVerb('channel.set-labels', f,
    () => forwardCall('xmtp', 'setLabels', { line, labels }),
    () => `set labels on ${line} → [${labels.join(', ')}]`);
}

async function channelMeta(p: string[], f: Flags): Promise<void> {
  const line = requireArg(p, 0, 'metro channel meta <line> [--name N] [--description D] [--github U] [--labels a,b]');
  const args: Record<string, unknown> = { line };
  const name = flagOne(f, 'name');
  const description = flagOne(f, 'description');
  const github = flagOne(f, 'github');
  const labelsRaw = flagOne(f, 'labels');
  if (name !== undefined) args['name'] = name;
  if (description !== undefined) args['description'] = description;
  const appData: Record<string, unknown> = {};
  if (github !== undefined) appData['github'] = github;
  if (labelsRaw !== undefined) appData['labels'] = labelsRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (Object.keys(appData).length) args['appData'] = appData;
  await runVerb('channel.meta', f,
    () => forwardCall('xmtp', 'updateChannelMeta', args),
    () => `updated meta on ${line}`);
}

async function channelInfo(p: string[], f: Flags): Promise<void> {
  const line = requireArg(p, 0, 'metro channel info <line>');
  await runVerb('channel.info', f,
    () => forwardCall('xmtp', 'groupInfo', { line }),
    r => JSON.stringify(r));
}

/** `metro group <new|close|members|info> …` */
export async function cmdGroup(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const sub = p[0];
  if (sub === 'new') return groupNew(p.slice(1), f);
  if (sub === 'close') return groupClose(p.slice(1), f);
  if (sub === 'add') return groupMembers(p.slice(1), f, 'addMembers');
  if (sub === 'remove') return groupMembers(p.slice(1), f, 'removeMembers');
  if (sub === 'info') return channelInfo(p.slice(1), f);
  throw exitErr('usage: metro group <new|close|add|remove|info> [args]', EXIT.usage);
}

async function groupNew(p: string[], f: Flags): Promise<void> {
  // addresses are positional (one or more 0x… ) and/or --member repeated.
  const addresses = p.filter(a => a.startsWith('0x'));
  const fromFlag = f.member;
  if (Array.isArray(fromFlag)) addresses.push(...fromFlag);
  else if (typeof fromFlag === 'string') addresses.push(fromFlag);
  if (!addresses.length) throw exitErr('usage: metro group new <0xaddr…> [--name N] [--admin-only]', EXIT.usage);
  const args: Record<string, unknown> = { addresses };
  const name = flagOne(f, 'name');
  if (name !== undefined) args['name'] = name;
  if (f['admin-only'] === true) args['permissions'] = 'admin-only';
  await runVerb('group.new', f,
    () => forwardCall('xmtp', 'newGroup', args),
    r => `created group ${(r as Record<string, unknown>)?.['line']}`);
}

async function groupClose(p: string[], f: Flags): Promise<void> {
  const line = requireArg(p, 0, 'metro group close <line>');
  await runVerb('group.close', f,
    () => forwardCall('xmtp', 'closeGroup', { line }),
    () => `closed group ${line}`);
}

async function groupMembers(p: string[], f: Flags, action: 'addMembers' | 'removeMembers'): Promise<void> {
  const line = requireArg(p, 0, `metro group ${action === 'addMembers' ? 'add' : 'remove'} <line> <0xaddr…>`);
  const addresses = p.slice(1).filter(a => a.startsWith('0x'));
  if (!addresses.length) throw exitErr(`usage: metro group ${action === 'addMembers' ? 'add' : 'remove'} <line> <0xaddr…>`, EXIT.usage);
  await runVerb(action === 'addMembers' ? 'group.add' : 'group.remove', f,
    () => forwardCall('xmtp', action, { line, addresses }),
    () => `${action === 'addMembers' ? 'added' : 'removed'} ${addresses.length} member(s) on ${line}`);
}

/** `metro dm <0xaddress>` — open (or reuse) a DM and print its line. */
export async function cmdDm(p: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const address = requireArg(p, 0, 'metro dm <0xaddress>');
  const account = flagOne(f, 'account');
  const args: Record<string, unknown> = { address };
  if (account !== undefined) args['account'] = account;
  await runVerb('dm', f,
    () => forwardCall('xmtp', 'newDm', args),
    r => `dm ${(r as Record<string, unknown>)?.['line']}`);
}
