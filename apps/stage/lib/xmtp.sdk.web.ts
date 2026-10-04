import {
  BackupElementSelectionOption, ConsentEntityType, ConsentState, Dm, Group, IdentifierKind,
  ReactionAction, ReactionSchema, SortDirection, encodeText,
  type ArchiveOptions, type Consent, type Conversation, type DecodedMessage, type Identifier, type InboxState,
  type Reaction, type Attachment as AttachmentContent,
} from '@xmtp/browser-sdk';
import type { ReactionPayload } from '@stage-labs/client/xmtp/builders';
import type { HistoryEntry } from '@stage-labs/client/types';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import { envelopeFromContent, type EnvelopeOptions } from '@stage-labs/client/xmtp/envelope';
import { consentStateToString } from '@stage-labs/client/xmtp/consent';
import { UNKNOWN_GROUP_POLICY, type GroupMetaPolicy } from '@stage-labs/client/xmtp/groups';
import { encodeDeleteMessage } from '@stage-labs/client/xmtp/deleteMessage';
import { xmtpClient } from './xmtp.client.web';
import { getCachedXmtpClient } from './xmtp.state.web';
import { withNestedReactions } from './feedOrder.model';
import { withMainThreadWasm } from './xmtp.wasm.web';
import { webGroupMetaPolicy } from './groupPolicyWeb.model';
import { webConsentState, webListOptions } from './consentWeb.model';
import { XMTP_USER_PREFIX } from '@stage-labs/client/xmtp/line';
import {
  NO_GROUP_ADMINS, NO_GROUP_INFO, convFinder, notAGroup, sendableFinder,
  type GroupMeta, type MessageDeletion, type MessageQuery, type MessageTarget, type XmtpSdk,
} from './xmtp.sdk.core';
import { reported, recover, ignore, ignored } from './errorPolicy';

type WebClient = Awaited<ReturnType<typeof xmtpClient>>;
type WebMessagesOptions = NonNullable<Parameters<Conversation['messages']>[0]>;
type EncodedContentArg = Parameters<Conversation['send']>[0];

const VISIBLE_STATES: ConsentState[] = [ConsentState.Allowed, ConsentState.Unknown];

const ARCHIVE_OPTIONS: ArchiveOptions = {
  elements: [BackupElementSelectionOption.Messages, BackupElementSelectionOption.Consent],
  excludeDisappearingMessages: false,
};

function isRemovedAction(action: Reaction['action']): boolean {
  return action === ReactionAction.Removed || (action as unknown) === 'removed';
}

function isCustomSchema(schema: Reaction['schema']): boolean {
  return schema === ReactionSchema.Custom || (schema as unknown) === 'custom';
}

const webEnvelopeOptions: EnvelopeOptions = {
  reactionRemoved: (action) => isRemovedAction(action as Reaction['action']),
  reactionCustom: (schema) => isCustomSchema(schema as Reaction['schema']),
  reactionCustomPayloadExtras: false,
  replyReferenceOf: (decoded) => (decoded as { referenceId: string }).referenceId,
  replyTextOf: (decoded) => {
    const c = (decoded as { content: unknown }).content;
    return typeof c === 'string' ? c : undefined;
  },
  attachmentNameOf: (decoded) => (decoded as AttachmentContent).filename,
  attachmentLabelOf: (decoded) => (decoded as AttachmentContent).filename ?? 'attachment',
  attachmentDataB64Of: (decoded) => bytesToBase64((decoded as AttachmentContent).content),
  requireObjectForHandlers: true,
};

function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  const base: HistoryEntry = {
    id: msg.id,
    ts: msg.sentAt.toISOString(),
    station: 'xmtp',
    line,
    from: `${XMTP_USER_PREFIX}${msg.senderInboxId}`,
    to: line,
    messageId: msg.id,
  };
  const typeId = msg.contentType.typeId;
  return envelopeFromContent(base, typeId, msg.content, msg.fallback, webEnvelopeOptions);
}

function identifierOf(address: string): Identifier {
  return { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
}

function identifiersOf(addresses: string[]): Identifier[] {
  return addresses.map(identifierOf);
}

function asGroup(conv: Conversation): Group {
  return conv instanceof Group ? conv : notAGroup();
}

function webQuery(q: MessageQuery): WebMessagesOptions {
  return {
    limit: BigInt(q.limit),
    ...(q.beforeMs === undefined ? {} : { sentBeforeNs: BigInt(q.beforeMs) * BigInt(1_000_000) }),
    ...(q.afterNs === undefined ? {} : { sentAfterNs: BigInt(Math.floor(q.afterNs)) }),
    direction: q.order === 'asc' ? SortDirection.Ascending : SortDirection.Descending,
  };
}

async function groupMetaPolicyOf(conv: Conversation): Promise<GroupMetaPolicy> {
  if (!(conv instanceof Group)) return UNKNOWN_GROUP_POLICY;
  const permissions = await conv.permissions().catch(recover('xmtp.groupMetaPolicy', null));
  return permissions ? webGroupMetaPolicy(permissions.policySet) : UNKNOWN_GROUP_POLICY;
}

function groupOptions(meta: GroupMeta): { groupName?: string; groupImageUrlSquare?: string } {
  return { groupName: meta.name, groupImageUrlSquare: meta.imageUrl };
}

function asEncoded(content: { content: Uint8Array }): EncodedContentArg {
  return content as unknown as EncodedContentArg;
}

function toWasmReaction(r: ReactionPayload): Reaction {
  return {
    reference: r.reference,
    referenceInboxId: '',
    action: r.action === 'removed' ? ReactionAction.Removed : ReactionAction.Added,
    content: r.content,
    schema: r.schema === 'custom' ? ReactionSchema.Custom : ReactionSchema.Unicode,
  };
}

interface StreamHandle { end: () => Promise<unknown> }

function endWhenCancelled(start: Promise<StreamHandle>): () => void {
  let handle: StreamHandle | null = null;
  let cancelled = false;
  start.then((stream) => {
    if (cancelled) { ignore(stream.end(), 'cleanup'); return; }
    handle = stream;
  }).catch(reported('xmtp.stream'));
  return () => {
    cancelled = true;
    if (handle) ignore(handle.end(), 'cleanup');
  };
}

async function streamAllMessages(
  client: WebClient, onMessage: (m: DecodedMessage | undefined) => void, onClose: () => void,
): Promise<() => void> {
  const handle = await client.conversations.streamAllMessages({
    onValue: onMessage,
    onError: reported('xmtp.messageStream'),
    onFail: onClose,
    consentStates: VISIBLE_STATES,
  });
  return () => { ignore(handle.end(), 'cleanup'); };
}

function streamConsent(client: WebClient, onChange: () => void): () => void {
  return endWhenCancelled(client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      if (records.some(c => c.entityType === ConsentEntityType.GroupId)) onChange();
    },
    onError: reported('xmtp.consentStream'),
  }));
}

function streamDeletions(client: WebClient, onDeleted: (deletion: MessageDeletion) => void): () => void {
  return endWhenCancelled(client.conversations.streamDeletedMessages({
    onValue: (m: DecodedMessage) => { onDeleted({ convId: m.conversationId, messageId: m.id }); },
    onError: reported('xmtp.deletionStream'),
  }));
}

async function deletedEntryOf(client: WebClient, messageId: string, line: string): Promise<HistoryEntry | null> {
  const m = await client.conversations.getMessageById(messageId);
  return m ? envelopeOfXmtpMessage(m, line) : null;
}

async function messageTarget(client: WebClient, messageId: string): Promise<MessageTarget<Conversation> | null> {
  const message = await client.conversations.getMessageById(messageId);
  const conv = message ? await client.conversations.getConversationById(message.conversationId) : undefined;
  return message && conv ? { conv, contentTypeId: message.contentType.typeId } : null;
}

async function dmLookup(client: WebClient, address: string): Promise<{
  find: () => Promise<Dm | undefined>; peerInboxId: () => Promise<string>;
} | null> {
  const inboxId = await client.fetchInboxIdByIdentifier(identifierOf(address));
  if (inboxId === undefined || inboxId === '') return null;
  return {
    find: () => client.conversations.getDmByInboxId(inboxId),
    peerInboxId: () => Promise.resolve(inboxId),
  };
}

function ethAddressOf(state: InboxState | undefined): string | undefined {
  return state?.accountIdentifiers.find(it => it.identifierKind === IdentifierKind.Ethereum)?.identifier;
}

async function ethAddressesOf(client: WebClient, inboxIds: string[]): Promise<(string | undefined)[]> {
  const states = await client.preferences.getInboxStates(inboxIds).catch(ignored<InboxState[]>([], 'cache'));
  const local = inboxIds.map((_, i) => ethAddressOf(states[i]));
  const missing = inboxIds.filter((_, i) => local[i] === undefined);
  if (missing.length === 0) return local;
  const fetched = new Map((await client.preferences.fetchInboxStates(missing)).map(s => [s.inboxId, ethAddressOf(s)]));
  return inboxIds.map((id, i) => local[i] ?? fetched.get(id));
}

export const sdk: XmtpSdk<WebClient, Conversation, DecodedMessage> = {
  client: xmtpClient,
  cachedClient: getCachedXmtpClient,
  findConv: (client, convId) => client.conversations.getConversationById(convId),
  listConvs: (client, consent) => client.conversations.list(webListOptions(consent)),
  syncConvList: (client) => client.conversations.sync(),
  syncVisible: (client) => client.conversations.syncAll(VISIBLE_STATES),
  syncConsent: (client) => client.preferences.sync(),
  openDm: (client, address) => client.conversations.createDmWithIdentifier(identifierOf(address)),
  activeDm: (client, peerInboxId) => client.conversations.createDm(peerInboxId),
  dmLookup,
  forceAddMember: null,
  inboxIdOfAddress: (client, address) => client.fetchInboxIdByIdentifier(identifierOf(address)),
  installationIdsOf: async (client, inboxId) =>
    ((await client.preferences.fetchInboxStates([inboxId]))[0]?.installations ?? []).map(i => i.id),
  keyPackageErrors: async (client, installationIds) =>
    [...(await client.fetchKeyPackageStatuses(installationIds)).values()].map(s => s.validationError),
  ethAddressesOf,
  newGroup: (client, addresses, meta) =>
    client.conversations.createGroupWithIdentifiers(identifiersOf(addresses), groupOptions(meta)),
  streamAllMessages,
  streamConversations: (client, onConv) =>
    endWhenCancelled(client.conversations.stream({ onValue: onConv, onError: reported('xmtp.convStream') })),
  streamConsent,
  streamDeletions,
  deletedEntryOf,
  messageTarget,
  history: {
    sendSyncRequest: (client, serverUrl) => client.sendSyncRequest(ARCHIVE_OPTIONS, serverUrl),
    syncDeviceGroups: (client) => client.syncAllDeviceSyncGroups(),
    processSyncArchive: (client) => client.processSyncArchive(null),
  },
  isGroup: (conv) => conv instanceof Group,
  isActive: (conv) => conv.isActive(),
  syncState: async (conv) => {
    const [info, paused] = await Promise.all([conv.debugInfo(), conv.pausedForVersion()]);
    return {
      epoch: Number(info.epoch),
      forked: info.maybeForked || info.isCommitLogForked === true,
      forkDetails: info.forkDetails,
      pausedForVersion: paused ?? '',
    };
  },
  dmPeerInboxId: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  groupName: (conv) => Promise.resolve(conv instanceof Group ? conv.name : undefined),
  groupInfo: (conv) => Promise.resolve(conv instanceof Group
    ? { name: conv.name ?? '', imageUrl: conv.imageUrl ?? '', description: conv.description ?? '' }
    : { ...NO_GROUP_INFO }),
  groupAdmins: (conv) => Promise.resolve(conv instanceof Group
    ? { admins: conv.admins, superAdmins: conv.superAdmins }
    : NO_GROUP_ADMINS),
  groupMetaPolicy: groupMetaPolicyOf,
  groupOps: (conv) => (conv instanceof Group ? conv : null),
  addMembers: (conv, addresses) => asGroup(conv).addMembersByIdentifiers(identifiersOf(addresses)),
  removeMembers: (conv, addresses) => asGroup(conv).removeMembersByIdentifiers(identifiersOf(addresses)),
  leaveOp: (conv) => (conv instanceof Group ? () => conv.requestRemoval() : null),
  createdAtNs: (conv) => (conv.createdAtNs === undefined ? 0 : Number(conv.createdAtNs)),
  addedByInboxId: (conv) => conv.addedByInboxId,
  consentOf: async (conv) => consentStateToString(await conv.consentState()),
  setConsent: (conv, state) => conv.updateConsentState(webConsentState(state)),
  messages: async (conv, query) => withNestedReactions(
    await conv.messages(webQuery(query)), (m) => m.reactions, (m) => Number(m.sentAtNs),
  ),
  rowOf: (m) => ({
    id: m.id,
    content: m.content,
    contentTypeId: m.contentType.typeId,
    senderInboxId: m.senderInboxId,
    sentNs: Number(m.sentAtNs),
  }),
  envelopeOf: envelopeOfXmtpMessage,
  sentNsOf: (m) => Number(m.sentAtNs),
  convIdOf: (m) => m.conversationId || null,
  deleteMessage: (conv, messageId) => conv.send(asEncoded(encodeDeleteMessage(messageId)), { shouldPush: false }),
  send: {
    text: (conv, text) => conv.sendText(text),
    reaction: (conv, reaction) => conv.sendReaction(toWasmReaction(reaction)),
    reply: async (conv, replyTo, text) => conv.sendReply({ reference: replyTo, content: await withMainThreadWasm(() => encodeText(text)) }),
    json: (conv, codec, content) => conv.send(asEncoded(codec.encode(content)), { shouldPush: codec.shouldPush() }),
  },
};

export const convOfLine = convFinder(sdk);

export const sendableConvOfLine = sendableFinder(sdk);
