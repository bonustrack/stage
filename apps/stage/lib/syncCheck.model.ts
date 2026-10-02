import type { SyncState } from './xmtp.sdk.core';

export interface SyncCheckInput {
  found: boolean;
  active: boolean;
  syncError: string;
  state: SyncState | null;
  newest: string;
}

export interface SyncCheckResult {
  ok: boolean;
  title: string;
  message: string;
}

const MAX_DETAIL = 300;

function verdict(input: SyncCheckInput): Omit<SyncCheckResult, 'message'> & { summary: string } {
  if (!input.found) return { ok: false, title: 'Not on this device', summary: 'This device has no copy of this channel yet.' };
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

function details(input: SyncCheckInput): string[] {
  if (!input.found) return [];
  return [
    input.newest === '' ? 'No messages on this device.' : `Newest message here: ${input.newest}`,
    input.state ? `Epoch: ${input.state.epoch}` : 'Could not read the sync state.',
    input.syncError === '' ? '' : `Error: ${clip(input.syncError)}`,
    input.state && input.state.forkDetails !== '' ? `Details: ${clip(input.state.forkDetails)}` : '',
  ].filter(line => line !== '');
}

export function syncCheckResult(input: SyncCheckInput): SyncCheckResult {
  const { ok, title, summary } = verdict(input);
  return { ok, title, message: [summary, ...details(input)].join('\n') };
}
