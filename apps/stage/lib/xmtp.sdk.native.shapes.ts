import type { GroupMetaPolicy, GroupPolicyOption } from '@stage-labs/client/xmtp/groups';
import {
  objectOf,
  stringOf,
  type CanonicalAttachment,
  type CanonicalDeletedMessage,
  type CanonicalReaction,
  type CanonicalReply,
  type XmtpMessage,
} from '@stage-labs/client/xmtp/message';
import { shortTypeId } from '@stage-labs/client/xmtp/typeId';
import { canonicalContent, type CanonicalReaders } from './xmtp.sdk.core';

interface NativeMessageView {
  id: string;
  senderInboxId: string;
  sentNs: number;
  contentTypeId: string;
  fallback?: string;
  content: () => unknown;
}

function reactionOf(raw: Record<string, unknown>): CanonicalReaction {
  return {
    reference: raw.reference as string,
    content: raw.content as string,
    removed: raw.action === 'removed',
    custom: raw.schema === 'custom',
  };
}

function replyOf(raw: Record<string, unknown>): CanonicalReply {
  const inner = objectOf(raw.content);
  return { reference: stringOf(raw.reference) ?? '', text: stringOf(inner?.text), remote: objectOf(inner?.remoteAttachment) };
}

function attachmentOf(raw: Record<string, unknown>): CanonicalAttachment {
  return { filename: stringOf(raw.filename), mimeType: stringOf(raw.mimeType), dataB64: stringOf(raw.data) ?? '' };
}

function deletedOf(raw: Record<string, unknown>): CanonicalDeletedMessage {
  return { deletedBy: raw.deletedBy === 'Admin' || raw.deletedBy === 'admin' ? 'admin' : 'sender' };
}

const CANONICAL: CanonicalReaders = { reaction: reactionOf, reply: replyOf, attachment: attachmentOf, deletedMessage: deletedOf };

export function nativeMessageOf(m: NativeMessageView): XmtpMessage {
  const contentTypeId = shortTypeId(m.contentTypeId);
  const base = {
    id: m.id,
    senderInboxId: m.senderInboxId,
    sentNs: m.sentNs,
    sentMs: Math.floor(m.sentNs / 1_000_000),
    contentTypeId,
    ...(m.fallback === undefined ? {} : { fallback: m.fallback }),
  };
  try {
    return { ...base, content: canonicalContent(CANONICAL, contentTypeId, m.content()) };
  } catch {
    return { ...base, content: undefined, undecodable: true };
  }
}

interface NativePolicySet {
  updateGroupNamePolicy: GroupPolicyOption;
  updateGroupDescriptionPolicy: GroupPolicyOption;
  updateGroupImagePolicy: GroupPolicyOption;
  updateAppDataPolicy: GroupPolicyOption;
  addMemberPolicy: GroupPolicyOption;
  removeMemberPolicy: GroupPolicyOption;
}

export function nativeGroupMetaPolicy(set: NativePolicySet): GroupMetaPolicy {
  return {
    name: set.updateGroupNamePolicy,
    description: set.updateGroupDescriptionPolicy,
    image: set.updateGroupImagePolicy,
    appData: set.updateAppDataPolicy,
    addMember: set.addMemberPolicy,
    removeMember: set.removeMemberPolicy,
  };
}

const NATIVE_TIMESTAMP_SCALES: readonly { above: number; toMs: number }[] = [
  { above: 1e17, toMs: 1e-6 },
  { above: 1e14, toMs: 1e-3 },
  { above: 1e11, toMs: 1 },
  { above: 0, toMs: 1e3 },
];

export function nativeInstallationCreatedAtMs(createdAt: unknown): number | undefined {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt <= 0) return undefined;
  const scale = NATIVE_TIMESTAMP_SCALES.find(({ above }) => createdAt > above);
  return scale === undefined ? undefined : Math.round(createdAt * scale.toMs);
}
