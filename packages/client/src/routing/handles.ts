import { STAGE_NAMES_PARENT, isStageName } from '../identity/stageNames';

export type HandleKind = 'address' | 'conversation' | 'stage' | 'basename' | 'ens' | 'invalid';

export interface ParsedHandle { kind: HandleKind; value: string }

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CONVERSATION_ID_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const NAME_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export const STAGE_ORIGIN = 'https://stage.box';

export const RESERVED_ROOT_SEGMENTS = new Set([
  'channels', 'channel', 'group', 'profile', 'user', 'settings', 'contacts', 'wallet', 'accounts',
  'requests', 'new-group', 'add-members', 'embed', 'xmtp',
]);

const PEER_KINDS = new Set<HandleKind>(['address', 'stage', 'basename', 'ens']);

export function isPeerHandleSegment(segment: string | null | undefined): boolean {
  const value = (segment ?? '').toLowerCase();
  if (value === '' || RESERVED_ROOT_SEGMENTS.has(value)) return false;
  return PEER_KINDS.has(parseHandle(value).kind);
}

export function parseHandle(raw: string | null | undefined): ParsedHandle {
  const value = (raw ?? '').trim();
  if (value === '') return { kind: 'invalid', value };
  if (ADDRESS_RE.test(value)) return { kind: 'address', value: value.toLowerCase() };
  if (CONVERSATION_ID_RE.test(value)) return { kind: 'conversation', value };
  const lower = value.toLowerCase();
  if (LABEL_RE.test(lower)) return { kind: 'stage', value: `${lower}.${STAGE_NAMES_PARENT}` };
  if (!NAME_RE.test(lower)) return { kind: 'invalid', value };
  if (lower.endsWith('.base.eth')) return { kind: 'basename', value: lower };
  if (lower.endsWith('.eth')) return { kind: 'ens', value: lower };
  return { kind: 'invalid', value };
}

export function stageLabelOf(handle: string | null | undefined): string | null {
  if (!handle || !isStageName(handle)) return null;
  return handle.slice(0, -(STAGE_NAMES_PARENT.length + 1)).toLowerCase();
}

export function profileSlugFor(address: string, handle?: string | null): string {
  return stageLabelOf(handle) ?? address.toLowerCase();
}

export function profilePathFor(address: string, handle?: string | null): string {
  return `/profile/${profileSlugFor(address, handle)}`;
}

export function conversationPathFor(peerAddress: string, handle?: string | null): string {
  return `/${profileSlugFor(peerAddress, handle)}`;
}

export function shareUrlFor(path: string): string {
  return `${STAGE_ORIGIN}/#${path}`;
}
