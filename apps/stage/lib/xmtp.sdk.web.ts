import {
  BackupElementSelectionOption, ConsentEntityType, ConsentState, Dm, Group, IdentifierKind,
  ReactionAction, ReactionSchema, SortDirection, encodeText,
  type ArchiveOptions, type Consent, type Conversation, type DecodedMessage, type Identifier, type Reaction,
} from '@xmtp/browser-sdk';
import type { ReactionPayload } from '@stage-labs/client/xmtp/builders';
import { consentStateToString } from '@stage-labs/client/xmtp/consent';
import { base64ToBytes } from '@stage-labs/client/text/base64';
import { xmtpClient } from './xmtp.client.web';
import { getCachedXmtpClient } from './xmtp.state.web';
import { envelopeOfXmtpMessage } from './xmtp.envelope.web';
import { historyServer } from './historyServer';
import type { XmtpConsent } from './xmtp.types';
import {
  NO_GROUP_ADMINS, NO_GROUP_INFO, convFinder, notAGroup,
  type GroupMeta, type MessageQuery, type XmtpSdk,
} from './xmtp.sdk.core';

type WebClient = Awaited<ReturnType<typeof xmtpClient>>;
type WebMessagesOptions = NonNullable<Parameters<Conversation['messages']>[0]>;
type EncodedContentArg = Parameters<Conversation['send']>[0];

const CONSENT_STATE: Record<XmtpConsent, ConsentState> = {
  allowed: ConsentState.Allowed,
  denied: ConsentState.Denied,
  unknown: ConsentState.Unknown,
};

const VISIBLE_STATES: ConsentState[] = [ConsentState.Allowed, ConsentState.Unknown];

const ARCHIVE_OPTIONS: ArchiveOptions = {
  elements: [BackupElementSelectionOption.Messages, BackupElementSelectionOption.Consent],
  excludeDisappearingMessages: false,
};

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
    direction: q.order === 'asc' ? SortDirection.Ascending : SortDirection.Descending,
  };
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
    if (cancelled) { void stream.end().catch(() => undefined); return; }
    handle = stream;
  }).catch(() => undefined);
  return () => {
    cancelled = true;
    if (handle) void handle.end().catch(() => undefined);
  };
}

async function streamAllMessages(
  client: WebClient, onMessage: (m: DecodedMessage | undefined) => void, onClose: () => void,
): Promise<() => void> {
  const handle = await client.conversations.streamAllMessages({
    onValue: onMessage,
    onError: () => undefined,
    onFail: onClose,
    consentStates: VISIBLE_STATES,
  });
  return () => { void handle.end().catch(() => undefined); };
}

function streamConsent(client: WebClient, onChange: () => void): () => void {
  return endWhenCancelled(client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      if (records.some(c => c.entityType === ConsentEntityType.GroupId)) onChange();
    },
    onError: () => undefined,
  }));
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

export const sdk: XmtpSdk<WebClient, Conversation, DecodedMessage> = {
  client: xmtpClient,
  cachedClient: getCachedXmtpClient,
  findConv: (client, convId) => client.conversations.getConversationById(convId),
  listConvs: (client, consent) => (consent
    ? client.conversations.list({ consentStates: consent.map(c => CONSENT_STATE[c]) })
    : client.conversations.list()),
  syncConvList: (client) => client.conversations.sync(),
  syncVisible: (client) => client.conversations.syncAll(VISIBLE_STATES),
  syncConsent: (client) => client.preferences.sync(),
  openDm: (client, address) => client.conversations.createDmWithIdentifier(identifierOf(address)),
  dmLookup,
  forceAddMember: null,
  inboxIdOfAddress: (client, address) => client.fetchInboxIdByIdentifier(identifierOf(address)),
  installationIdsOf: async (client, inboxId) =>
    ((await client.preferences.fetchInboxStates([inboxId]))[0]?.installations ?? []).map(i => i.id),
  keyPackageErrors: async (client, installationIds) =>
    [...(await client.fetchKeyPackageStatuses(installationIds)).values()].map(s => s.validationError),
  ethAddressesOf: async (client, inboxIds) => {
    const states = await client.preferences.getInboxStates(inboxIds);
    return inboxIds.map((_, i) =>
      states[i]?.accountIdentifiers.find(it => it.identifierKind === IdentifierKind.Ethereum)?.identifier);
  },
  newGroup: (client, addresses, meta) =>
    client.conversations.createGroupWithIdentifiers(identifiersOf(addresses), groupOptions(meta)),
  streamAllMessages,
  streamConversations: (client, onConv) =>
    endWhenCancelled(client.conversations.stream({ onValue: onConv, onError: () => undefined })),
  streamConsent,
  history: {
    sendSyncRequest: async (client) => client.sendSyncRequest(ARCHIVE_OPTIONS, await historyServer()),
    sendSyncArchive: (client, pin, serverUrl) => client.sendSyncArchive(pin, ARCHIVE_OPTIONS, serverUrl),
    syncDeviceGroups: (client) => client.syncAllDeviceSyncGroups(),
    countArchives: async (client, lookbackDays) => (await client.listAvailableArchives(lookbackDays)).length,
    processSyncArchive: (client, pin) => client.processSyncArchive(pin ?? null),
  },
  isGroup: (conv) => conv instanceof Group,
  dmPeerInboxId: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  groupName: (conv) => Promise.resolve(conv instanceof Group ? conv.name : undefined),
  groupInfo: (conv) => Promise.resolve(conv instanceof Group
    ? { name: conv.name ?? '', imageUrl: conv.imageUrl ?? '', description: conv.description ?? '' }
    : { ...NO_GROUP_INFO }),
  groupAdmins: (conv) => Promise.resolve(conv instanceof Group
    ? { admins: conv.admins, superAdmins: conv.superAdmins }
    : NO_GROUP_ADMINS),
  groupOps: (conv) => (conv instanceof Group ? conv : null),
  addMembers: (conv, addresses) => asGroup(conv).addMembersByIdentifiers(identifiersOf(addresses)),
  removeMembers: (conv, addresses) => asGroup(conv).removeMembersByIdentifiers(identifiersOf(addresses)),
  leaveOp: (conv) => (conv instanceof Group ? () => conv.requestRemoval() : null),
  createdAtNs: (conv) => (conv.createdAtNs === undefined ? 0 : Number(conv.createdAtNs)),
  consentOf: async (conv) => consentStateToString(await conv.consentState()),
  setConsent: (conv, state) => conv.updateConsentState(CONSENT_STATE[state]),
  messages: (conv, query) => conv.messages(webQuery(query)),
  rowOf: (m) => ({
    id: m.id,
    content: m.content,
    contentTypeId: m.contentType.typeId,
    senderInboxId: m.senderInboxId,
    sentNs: Number(m.sentAtNs),
  }),
  envelopeOf: envelopeOfXmtpMessage,
  sentNsOf: (m) => Number(m.sentAtNs),
  sentNsText: (m) => String(m.sentAtNs),
  convIdOf: (m) => m.conversationId || null,
  send: {
    text: (conv, text) => conv.sendText(text),
    reaction: (conv, reaction) => conv.sendReaction(toWasmReaction(reaction)),
    reply: async (conv, replyTo, text) => conv.sendReply({ reference: replyTo, content: await encodeText(text) }),
    json: (conv, codec, content) => conv.send(asEncoded(codec.encode(content))),
    attachment: (conv, filename, mimeType, dataB64) =>
      conv.sendAttachment({ filename, mimeType, content: base64ToBytes(dataB64) }),
  },
};

export const convOfLine = convFinder(sdk);
