import { isMissingMlsState } from '@stage-labs/client/xmtp/clientErrors';
import type { SyncState } from './xmtp.sdk.core';
import { describeError } from './errorPolicy';
import { within } from './history.model';

export interface SyncCheckInput {
  found: boolean;
  restored?: boolean;
  inviteError?: string;
  nativeError?: string;
  active: boolean;
  syncError: string;
  state: SyncState | null;
  newest: string;
  device?: string;
}

export interface SyncCheckResult {
  ok: boolean;
  title: string;
  message: string;
}

const MAX_DETAIL = 300;
const RESTORED_COPY = 'This device only has a restored copy of this channel from the history import, so it is not a member yet.';

function restoredVerdict(input: SyncCheckInput): Omit<SyncCheckResult, 'message'> & { summary: string } {
  if (input.active) return { ok: true, title: 'Joined now', summary: 'This device just took in its invite to this channel. Open the channel again.' };
  if (input.inviteError === undefined) return { ok: false, title: 'Not in the channel yet', summary: `${RESTORED_COPY} It is added when a member next sends a message.` };
  if (input.inviteError === '') return { ok: false, title: 'Not in the channel yet', summary: `${RESTORED_COPY} The invite sync ran, but no invite for this channel reached this device.` };
  return { ok: false, title: 'Not in the channel yet', summary: `${RESTORED_COPY} This device could not take in its channel invites.` };
}

function verdict(input: SyncCheckInput): Omit<SyncCheckResult, 'message'> & { summary: string } {
  if (!input.found) return { ok: false, title: 'Not on this device', summary: 'This device has no copy of this channel yet.' };
  if (input.restored === true) return restoredVerdict(input);
  const paused = input.state?.pausedForVersion ?? '';
  if (paused !== '') {
    return { ok: false, title: 'Update needed', summary: `This channel needs messaging version ${paused} or newer. This device skips new messages until it is updated.` };
  }
  if (!input.active) {
    return { ok: false, title: 'Not in the channel yet', summary: 'This device is not a member of this channel yet. It is added when a member next sends a message.' };
  }
  if (input.state?.forked === true) {
    return { ok: false, title: 'Out of sync', summary: 'This device lost track of this channel, so it cannot read new messages here. Your other devices are not affected.' };
  }
  if (input.syncError !== '') return { ok: false, title: 'Sync failed', summary: 'This device could not sync this channel.' };
  return { ok: true, title: 'In sync', summary: 'This device is up to date with this channel.' };
}

function clip(text: string): string {
  return text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL)}…` : text;
}

function localDetails(input: SyncCheckInput): string[] {
  if (input.restored === true) return [];
  return [
    input.newest === '' ? 'No messages on this device.' : `Newest message here: ${input.newest}`,
    input.state ? `Epoch: ${input.state.epoch}` : 'Could not read the sync state.',
  ];
}

function nativeDetail(nativeError: string | undefined): string {
  if (nativeError === undefined) return '';
  return `Native: ${nativeError === '' ? 'no error logged, the channel state is missing' : clip(nativeError)}`;
}

function details(input: SyncCheckInput): string[] {
  if (!input.found) return [];
  const inviteError = input.inviteError ?? '';
  return [
    ...localDetails(input),
    inviteError === '' ? '' : `Invite sync: ${clip(inviteError)}`,
    input.syncError === '' ? '' : `Error: ${clip(input.syncError)}`,
    nativeDetail(input.nativeError),
    input.state && input.state.forkDetails !== '' ? `Details: ${clip(input.state.forkDetails)}` : '',
    input.device === undefined || input.device === '' ? '' : `Device: ${input.device}`,
  ].filter(line => line !== '');
}

export function syncCheckResult(input: SyncCheckInput): SyncCheckResult {
  const { ok, title, summary } = verdict(input);
  return { ok, title, message: [summary, ...details(input)].join('\n') };
}

interface SyncCheckOps<C> {
  find: () => Promise<C | null | undefined>;
  isActive: (conv: C) => Promise<boolean>;
  sync: (conv: C) => Promise<unknown>;
  details: (conv: C) => Promise<Pick<SyncCheckInput, 'state' | 'newest'>>;
  syncInvites?: () => Promise<unknown>;
  nativeError?: (work: () => Promise<unknown>) => Promise<string>;
  device?: string;
}

type Step = <T>(label: string, work: () => Promise<T>) => Promise<T>;

async function checkRestoredCopy<C>(ops: SyncCheckOps<C>, step: Step, lookupError: string): Promise<SyncCheckResult> {
  const restored: SyncCheckInput = {
    found: true, restored: true, active: false, syncError: lookupError, state: null, newest: '', device: ops.device,
  };
  const { syncInvites, nativeError } = ops;
  if (!syncInvites) return syncCheckResult(restored);
  let input = restored;
  try {
    await step('Invite sync', syncInvites);
    const conv = await step('Local channel lookup after the invite sync', ops.find);
    const active = conv ? await step('Channel membership after the invite sync', () => ops.isActive(conv)) : false;
    if (active) return syncCheckResult({ ...restored, inviteError: '', active, syncError: '' });
    input = { ...restored, inviteError: '' };
  } catch (err) {
    input = { ...restored, inviteError: isMissingMlsState(err) ? '' : describeError(err) };
  }
  if (!nativeError) return syncCheckResult(input);
  const captured = await step('Native error capture', () => nativeError(ops.find)).catch(describeError);
  return syncCheckResult({ ...input, nativeError: captured });
}

export async function runSyncCheck<C>(ops: SyncCheckOps<C>, timeoutMs = 15_000): Promise<SyncCheckResult> {
  const deadline = Date.now() + timeoutMs;
  let phase = 'Local channel lookup';
  const step: Step = (label, work) => {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error('The check timed out.');
    phase = label;
    return within(work(), left, 'The check timed out.');
  };
  try {
    const conv = await step('Local channel lookup', ops.find);
    if (!conv) return syncCheckResult({ found: false, active: false, syncError: '', state: null, newest: '' });
    const active = await step('Channel membership', () => ops.isActive(conv));
    const syncError = active ? await step('Channel network sync', () => ops.sync(conv)).then(() => '', describeError) : '';
    const detail = await step('Local sync state and newest message', () => ops.details(conv));
    return syncCheckResult({ found: true, active, syncError, device: ops.device, ...detail });
  } catch (err) {
    if (isMissingMlsState(err)) return checkRestoredCopy(ops, step, describeError(err));
    return { ok: false, title: 'Couldn’t check sync', message: `${phase}: ${clip(describeError(err))}` };
  }
}
