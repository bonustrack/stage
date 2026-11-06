import { parseHandle } from '../routing/handles';
import { displayHandle, isStageName, stageLabelOf, validateStageLabel } from './stageNames';

export const HANDLE_PLACEHOLDER = '0x…, @username or name.base.eth';
export const HANDLE_HELP = 'Enter a 0x address, a @username or a name.base.eth';

export type PersonQuery = { kind: 'address'; address: string } | { kind: 'name'; name: string; onMainnet: boolean };

export interface LookupPolicy {
  mainnetEns: boolean;
}

export const BASE_NAMES_ONLY: LookupPolicy = { mainnetEns: false };
export const WITH_MAINNET_ENS: LookupPolicy = { mainnetEns: true };

export function personQuery(input: string): PersonQuery | null {
  const typed = input.trim().replace(/^@/, '');
  const parsed = parseHandle(typed);
  if (parsed.kind === 'address') return { kind: 'address', address: parsed.value };
  if (parsed.kind === 'stage') {
    const bareLabel = !isStageName(typed);
    if (bareLabel && validateStageLabel(stageLabelOf(parsed.value) ?? '') !== null) return null;
    return { kind: 'name', name: parsed.value, onMainnet: false };
  }
  if (parsed.kind === 'basename' || parsed.kind === 'ens') return { kind: 'name', name: parsed.value, onMainnet: parsed.kind === 'ens' };
  return null;
}

export type PersonLookup =
  | { kind: 'empty'; input: string }
  | { kind: 'invalid'; input: string }
  | { kind: 'resolving'; input: string; name: string; label: string }
  | { kind: 'resolved'; input: string; address: string; label: string | null }
  | { kind: 'unresolved'; input: string; label: string }
  | { kind: 'unsupported'; input: string; label: string };

export interface LookupHint {
  text: string;
  tone: 'secondary' | 'danger';
}

export function startLookup(input: string, policy: LookupPolicy): PersonLookup {
  if (input.trim() === '') return { kind: 'empty', input };
  const query = personQuery(input);
  if (query === null) return { kind: 'invalid', input };
  if (query.kind === 'address') return { kind: 'resolved', input, address: query.address, label: null };
  const label = displayHandle(query.name);
  if (query.onMainnet && !policy.mainnetEns) return { kind: 'unsupported', input, label };
  return { kind: 'resolving', input, name: query.name, label };
}

export function settleLookup(state: PersonLookup, address: string | null): PersonLookup {
  if (state.kind !== 'resolving') return state;
  if (address === null) return { kind: 'unresolved', input: state.input, label: state.label };
  return { kind: 'resolved', input: state.input, address: address.toLowerCase(), label: state.label };
}

export function lookupFor(stored: PersonLookup, input: string, policy: LookupPolicy): PersonLookup {
  return stored.input === input ? stored : startLookup(input, policy);
}

export function lookupAddress(state: PersonLookup): string | null {
  return state.kind === 'resolved' ? state.address : null;
}

export function lookupHint(state: PersonLookup): LookupHint | undefined {
  if (state.kind === 'resolving') return { text: `Looking up ${state.label}…`, tone: 'secondary' };
  if (state.kind === 'unresolved') return { text: `No address found for ${state.label}`, tone: 'danger' };
  if (state.kind === 'unsupported')
    return { text: `${state.label} is a mainnet ENS name. Stage only supports names on Base.`, tone: 'danger' };
  if (state.kind === 'invalid') return { text: HANDLE_HELP, tone: 'secondary' };
  return undefined;
}
