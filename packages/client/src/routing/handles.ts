import { STAGE_NAMES_PARENT, isStageName, stageLabelOf } from '../identity/stageNames';
import { RESERVED_ROOT_SEGMENTS } from './routes';

export type HandleKind = 'address' | 'conversation' | 'stage' | 'basename' | 'ens' | 'invalid';

export interface ParsedHandle {
  kind: HandleKind;
  value: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CHANNEL_ID_RE = /^[0-9a-f]{32}$/i;
const INBOX_ID_RE = /^[0-9a-f]{64}$/i;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const NAME_RE = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

const PEER_KINDS = new Set<HandleKind>(['address', 'stage', 'basename', 'ens']);

function isConversationId(value: string): boolean {
  const bare = value.startsWith('0x') ? value.slice(2) : value;
  return CHANNEL_ID_RE.test(bare) || INBOX_ID_RE.test(bare);
}

export function profileKindOf(id: string | null | undefined): 'channel' | 'user' {
  return CHANNEL_ID_RE.test((id ?? '').trim()) ? 'channel' : 'user';
}

export function isPeerHandleSegment(segment: string | null | undefined): boolean {
  const value = (segment ?? '').toLowerCase();
  if (value === '' || RESERVED_ROOT_SEGMENTS.has(value)) return false;
  return PEER_KINDS.has(parseHandle(value).kind);
}

export function parseHandle(raw: string | null | undefined): ParsedHandle {
  const value = (raw ?? '').trim();
  if (value === '') return { kind: 'invalid', value };
  if (ADDRESS_RE.test(value)) return { kind: 'address', value: value.toLowerCase() };
  if (isConversationId(value)) return { kind: 'conversation', value };
  const lower = value.toLowerCase();
  if (LABEL_RE.test(lower)) return { kind: 'stage', value: `${lower}.${STAGE_NAMES_PARENT}` };
  if (!NAME_RE.test(lower)) return { kind: 'invalid', value };
  if (isStageName(lower)) return { kind: 'stage', value: lower };
  if (lower.endsWith('.base.eth')) return { kind: 'basename', value: lower };
  if (lower.endsWith('.eth')) return { kind: 'ens', value: lower };
  return { kind: 'invalid', value };
}

export function profileSlugFor(address: string, handle?: string | null): string {
  return stageLabelOf(handle) ?? address.toLowerCase();
}

export function conversationSlugFor(peerAddress: string, handle?: string | null): string {
  const slug = profileSlugFor(peerAddress, handle);
  return isPeerHandleSegment(slug) ? slug : peerAddress.toLowerCase();
}

export function conversationPathFor(peerAddress: string, handle?: string | null): string {
  return `/${conversationSlugFor(peerAddress, handle)}`;
}
