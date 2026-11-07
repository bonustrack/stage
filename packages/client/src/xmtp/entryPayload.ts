import type { GroupUpdatedContent } from './humanize';
import type { PollContent } from './poll';
import type { SignatureReferenceContent, SignatureRequestContent } from './sign';
import type { TransactionReferenceContent, WalletSendCallsContent } from './tx';
import type { FrameActionContent, FrameContent } from './frame';
import { parseCallInvite, parseCallSignal, type CallInvite, type CallSignal } from './call';
import { DELETED_MESSAGE_TYPE_ID, DELETE_MESSAGE_TYPE_ID, type DeletedBy } from './deleteMessage';
import { objectOf } from './message';

export type AttachmentKey = string | Uint8Array;

export interface RemoteAttachmentRef {
  url: string;
  contentDigest: string;
  secret: AttachmentKey;
  salt: AttachmentKey;
  nonce: AttachmentKey;
  scheme?: string;
  contentLength?: number | string;
  filename?: string;
}

export interface EntryAttachment {
  kind: string;
  name?: string;
  mime?: string;
  dataB64?: string;
  remote?: RemoteAttachmentRef;
  id?: string;
  url?: string;
  size?: number;
}

interface StructuredContents {
  poll: PollContent;
  signatureRequest: SignatureRequestContent;
  signatureReference: SignatureReferenceContent;
  walletSendCalls: WalletSendCallsContent;
  transactionReference: TransactionReferenceContent;
  frame: FrameContent;
}

const STRUCTURED_KEYS = {
  poll: 'poll',
  signatureRequest: 'signatureRequest',
  signatureReference: 'signatureReference',
  walletSendCalls: 'walletSendCalls',
  transactionReference: 'txReference',
  frame: 'frame',
} as const satisfies Record<keyof StructuredContents, string>;

export type StructuredType = keyof StructuredContents;

type StructuredPayload<T extends StructuredType> = { contentType: T } & Record<(typeof STRUCTURED_KEYS)[T], StructuredContents[T]>;

export type EntryPayload =
  | { contentType: string; reactTo: string; emoji: string; removed: boolean; schema?: 'custom' }
  | { contentType?: string; attachments: EntryAttachment[]; replyTo?: string }
  | { contentType: 'reply'; replyTo: string }
  | { [T in StructuredType]: StructuredPayload<T> }[StructuredType]
  | { contentType: 'frameAction'; frameAction: FrameActionContent }
  | { contentType: 'callInvite'; callInvite?: CallInvite }
  | { contentType: 'callSignal'; callSignal?: CallSignal }
  | { contentType: typeof DELETE_MESSAGE_TYPE_ID; deletes?: string }
  | { contentType: typeof DELETED_MESSAGE_TYPE_ID; deletedBy: DeletedBy }
  | { contentType: string; system: true; groupUpdate?: GroupUpdatedContent }
  | { contentType: string };

export function structuredPayload<T extends StructuredType>(typeId: T, content: StructuredContents[T]): EntryPayload {
  return { contentType: typeId, [STRUCTURED_KEYS[typeId]]: content };
}

export function attachmentsPayload(attachments: EntryAttachment[]): EntryPayload {
  return { attachments };
}

interface PayloadHolder {
  payload?: unknown;
}

function fieldOf(entry: PayloadHolder | undefined, key: string): unknown {
  return objectOf(entry?.payload)?.[key];
}

function objectField(
  entry: PayloadHolder | undefined,
  key: string,
  valid: (value: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  const value = objectOf(fieldOf(entry, key));
  return value !== undefined && valid(value) ? value : undefined;
}

export function payloadTypeOf(entry: PayloadHolder | undefined): string | undefined {
  const type = fieldOf(entry, 'contentType');
  return typeof type === 'string' ? type : undefined;
}

export function reactionTargetOf(entry: PayloadHolder | undefined): string | undefined {
  const target = fieldOf(entry, 'reactTo');
  return typeof target === 'string' && target !== '' ? target : undefined;
}

export interface EntryReaction {
  reactTo: string;
  emoji: string;
  removed: boolean;
  custom: boolean;
}

export function reactionOf(entry: PayloadHolder | undefined): EntryReaction | null {
  const reactTo = fieldOf(entry, 'reactTo');
  const emoji = fieldOf(entry, 'emoji');
  if (typeof reactTo !== 'string' || typeof emoji !== 'string') return null;
  return { reactTo, emoji, removed: !!fieldOf(entry, 'removed'), custom: fieldOf(entry, 'schema') === 'custom' };
}

export function isSystemEntry(entry: PayloadHolder | undefined): boolean {
  return fieldOf(entry, 'system') === true;
}

export function groupUpdateOf(entry: PayloadHolder | undefined): GroupUpdatedContent | null {
  const update = objectOf(fieldOf(entry, 'groupUpdate'));
  return isSystemEntry(entry) && update !== undefined ? update : null;
}

export function attachmentsOf(entry: PayloadHolder | undefined): EntryAttachment[] {
  const attachments = fieldOf(entry, 'attachments');
  return Array.isArray(attachments) ? (attachments as EntryAttachment[]) : [];
}

export function hasAttachments(entry: PayloadHolder | undefined): boolean {
  return attachmentsOf(entry).length > 0;
}

export function pollContentOf(entry: PayloadHolder | undefined): PollContent | undefined {
  return objectField(entry, 'poll', () => true) as PollContent | undefined;
}

export function signatureRequestOf(entry: PayloadHolder | undefined): SignatureRequestContent | undefined {
  return objectField(entry, 'signatureRequest', (v) => !!v.kind) as SignatureRequestContent | undefined;
}

export function signatureReferenceOf(entry: PayloadHolder | undefined): SignatureReferenceContent | undefined {
  return objectField(entry, 'signatureReference', (v) => !!v.signature) as SignatureReferenceContent | undefined;
}

export function walletSendCallsOf(entry: PayloadHolder | undefined): WalletSendCallsContent | undefined {
  return objectField(entry, 'walletSendCalls', (v) => Array.isArray(v.calls)) as WalletSendCallsContent | undefined;
}

export function txReferenceOf(entry: PayloadHolder | undefined): TransactionReferenceContent | undefined {
  return objectField(entry, 'txReference', (v) => !!v.reference) as TransactionReferenceContent | undefined;
}

export function frameFieldOf(entry: PayloadHolder | undefined): object | null {
  return objectOf(fieldOf(entry, 'frame')) ?? null;
}

export function isFrameActionEntry(entry: PayloadHolder | undefined): boolean {
  return objectOf(fieldOf(entry, 'frameAction')) !== undefined;
}

export function callInviteOf(entry: PayloadHolder | undefined): CallInvite | null {
  return parseCallInvite(fieldOf(entry, 'callInvite'));
}

export function callSignalOf(entry: PayloadHolder | undefined): CallSignal | null {
  return parseCallSignal(fieldOf(entry, 'callSignal'));
}

export function isDeleteRequest(entry: PayloadHolder | undefined): boolean {
  return payloadTypeOf(entry) === DELETE_MESSAGE_TYPE_ID;
}

export function deleteTargetOf(entry: PayloadHolder | undefined): string | undefined {
  const target = fieldOf(entry, 'deletes');
  return typeof target === 'string' ? target : undefined;
}

export function isDeletedPlaceholder(entry: PayloadHolder | undefined): boolean {
  return payloadTypeOf(entry) === DELETED_MESSAGE_TYPE_ID;
}

export function deletedByOf(entry: PayloadHolder | undefined): DeletedBy {
  return fieldOf(entry, 'deletedBy') === 'admin' ? 'admin' : 'sender';
}

const KIND_TESTS = [
  ['deleted', isDeletedPlaceholder],
  ['frameAction', isFrameActionEntry],
  ['poll', (e) => pollContentOf(e) !== undefined],
  ['txRequest', (e) => walletSendCallsOf(e) !== undefined],
  ['txReceipt', (e) => txReferenceOf(e) !== undefined],
  ['sigRequest', (e) => signatureRequestOf(e) !== undefined],
  ['sigReference', (e) => signatureReferenceOf(e) !== undefined],
  ['frame', (e) => frameFieldOf(e) !== null],
  ['call', (e) => callInviteOf(e) !== null],
  ['hidden', (e) => isDeleteRequest(e) || callSignalOf(e) !== null || payloadTypeOf(e) === 'callSignal'],
  ['system', isSystemEntry],
  ['reaction', (e) => reactionTargetOf(e) !== undefined],
  ['attachments', hasAttachments],
] as const satisfies readonly (readonly [string, (entry: PayloadHolder) => boolean])[];

export type MessageKind = (typeof KIND_TESTS)[number][0] | 'text';

export function messageKindOf(entry: PayloadHolder): MessageKind {
  return KIND_TESTS.find(([, test]) => test(entry))?.[0] ?? 'text';
}

export function attachmentSummaryOf(attachments: readonly Pick<EntryAttachment, 'kind' | 'name'>[]): string {
  const first = attachments[0];
  if (first !== undefined && attachments.length === 1) return `[${first.kind}: ${first.name ?? 'attachment'}]`;
  return `[${attachments.length} attachments]`;
}

export function isAttachmentSummary(entry: { text?: string; payload?: unknown }): boolean {
  const attachments = attachmentsOf(entry);
  return attachments.length > 0 && entry.text !== undefined && entry.text.trim() === attachmentSummaryOf(attachments);
}
