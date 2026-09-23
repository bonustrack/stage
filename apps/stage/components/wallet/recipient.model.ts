import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { peopleLookup } from '../home/contacts.model';

export const RECIPIENT_PLACEHOLDER = '0x…, @username or name.base.eth';
export const RECIPIENT_HELP = 'Enter a 0x address, a @username or a name.base.eth';

const BASE_NAME_SUFFIX = '.base.eth';

export interface RecipientQuery {
  handle: string;
  label: string | null;
}

export type RecipientState =
  | { kind: 'empty'; input: string }
  | { kind: 'invalid'; input: string }
  | { kind: 'resolving'; input: string; query: RecipientQuery }
  | { kind: 'resolved'; input: string; address: string; label: string | null }
  | { kind: 'unresolved'; input: string; label: string }
  | { kind: 'unsupported'; input: string; label: string };

export interface RecipientHint {
  text: string;
  tone: 'secondary' | 'danger';
}

export interface RecipientSummary {
  title: string;
  label: string | null;
  address: string;
}

const NETWORK_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base', 11155111: 'Sepolia' };

export function recipientQuery(input: string): RecipientQuery | null {
  const lookup = peopleLookup(input);
  if (lookup === null) return null;
  return { handle: lookup.handle, label: lookup.title === '' ? null : displayHandle(lookup.handle) };
}

export function startRecipient(input: string): RecipientState {
  if (input.trim() === '') return { kind: 'empty', input };
  const query = recipientQuery(input);
  if (query === null) return { kind: 'invalid', input };
  if (query.label === null) return { kind: 'resolved', input, address: query.handle, label: null };
  if (!query.handle.endsWith(BASE_NAME_SUFFIX)) return { kind: 'unsupported', input, label: query.label };
  return { kind: 'resolving', input, query };
}

export function settleRecipient(state: RecipientState, address: string | null): RecipientState {
  if (state.kind !== 'resolving') return state;
  const label = state.query.label ?? state.query.handle;
  if (address === null) return { kind: 'unresolved', input: state.input, label };
  return { kind: 'resolved', input: state.input, address: address.toLowerCase(), label };
}

export function recipientFor(stored: RecipientState, input: string): RecipientState {
  return stored.input === input ? stored : startRecipient(input);
}

export function recipientAddress(state: RecipientState): string | null {
  return state.kind === 'resolved' ? state.address : null;
}

export function recipientHint(state: RecipientState): RecipientHint | undefined {
  if (state.kind === 'resolving') return { text: `Looking up ${state.query.label ?? state.query.handle}…`, tone: 'secondary' };
  if (state.kind === 'unresolved') return { text: `No address found for ${state.label}`, tone: 'danger' };
  if (state.kind === 'unsupported') return { text: `${state.label} is a mainnet ENS name. Stage only supports names on Base.`, tone: 'danger' };
  if (state.kind === 'invalid') return { text: RECIPIENT_HELP, tone: 'secondary' };
  return undefined;
}

export function recipientSummary(state: RecipientState, shorten: (address: string) => string): RecipientSummary | null {
  if (state.kind !== 'resolved') return null;
  return { title: state.label ?? shorten(state.address), label: state.label, address: state.address };
}

export function networkName(chainId: number): string {
  return NETWORK_NAMES[chainId] ?? `Chain ${chainId}`;
}
