import {
  Client, Dm, Group, PublicIdentity, addGroupMembers, staticKeyPackageStatuses,
  type Conversation, type ConversationId, type MessageId,
} from '@xmtp/react-native-sdk';
import { buildReply } from '@stage-labs/client/xmtp/builders';
import { mapDecodedToEnvelope } from '@stage-labs/client/xmtp/envelope';
import { convIdFromTopic, isMissingMlsState, pickNativeErrors } from '@stage-labs/client/xmtp/clientErrors';
import { UNKNOWN_GROUP_POLICY, groupMetaPolicyOfSet, type GroupMetaPolicy } from '@stage-labs/client/xmtp/groups';
import { xmtpClient } from './xmtp.client';
import { getCachedXmtpClient } from './xmtp.state';
import {
  NO_GROUP_ADMINS, NO_GROUP_INFO, VISIBLE_CONSENT, convFinder, notAGroup, sendableFinder,
  type MessageDeletion, type MessageQuery, type MessageTarget, type XmtpSdk,
} from './xmtp.sdk.core';
import { reported, recover, attempt, ignored } from './errorPolicy';
import { archiveFromBytes, archiveToBytes } from './archiveFile';

type NativeClient = Awaited<ReturnType<typeof xmtpClient>>;
type NativeMessage = Awaited<ReturnType<Conversation['messages']>>[number];
type NativeMessagesOptions = NonNullable<Parameters<Conversation['messages']>[0]>;
type InstallationIds = Parameters<typeof staticKeyPackageStatuses>[1];
type NativeArchiveOptions = NonNullable<Parameters<NativeClient['createArchive']>[2]>;

const ARCHIVE_OPTIONS: NativeArchiveOptions = { archiveElements: ['messages', 'consent'], excludeDisappearingMessages: false };

const LIST_OPTIONS: NonNullable<Parameters<NativeClient['conversations']['list']>[0]> = {
  isActive: false, name: false, imageUrl: false, description: false,
};

const asConversationId = (id: string): ConversationId => id as ConversationId;

const asMessageId = (id: string): MessageId => id as MessageId;

function identityOf(address: string): PublicIdentity {
  return new PublicIdentity(address, 'ETHEREUM');
}

function identitiesOf(addresses: string[]): PublicIdentity[] {
  return addresses.map(identityOf);
}

function asGroup(conv: Conversation): Group {
  return conv instanceof Group ? conv : notAGroup();
}

function nativeQuery(q: MessageQuery): NativeMessagesOptions {
  return {
    limit: q.limit,
    ...(q.beforeMs === undefined ? {} : { beforeNs: q.beforeMs * 1_000_000 }),
    ...(q.order === undefined ? {} : { direction: q.order === 'asc' ? 'ASCENDING' : 'DESCENDING' }),
  };
}

function contentOf(m: NativeMessage): unknown {
  try { return m.content(); } catch { return undefined; }
}

function conversationIdField(m: NativeMessage): string | undefined {
  return 'conversationId' in m && typeof m.conversationId === 'string' ? m.conversationId : undefined;
}

function groupInfoField(read: () => Promise<string>): Promise<string> {
  return read().catch((err: unknown) => {
    if (isMissingMlsState(err)) throw err;
    return recover('xmtp.groupInfo', '')(err);
  });
}

async function groupInfoOf(conv: Conversation): Promise<{ name: string; imageUrl: string; description: string }> {
  if (!(conv instanceof Group)) return { ...NO_GROUP_INFO };
  const [name, imageUrl, description] = await Promise.all([
    groupInfoField(() => conv.name()),
    groupInfoField(() => conv.imageUrl()),
    groupInfoField(() => conv.description()),
  ]);
  return { name, imageUrl, description };
}

async function groupAdminsOf(conv: Conversation): Promise<{ admins: string[]; superAdmins: string[] }> {
  if (!(conv instanceof Group)) return NO_GROUP_ADMINS;
  const [admins, superAdmins] = await Promise.all([
    conv.listAdmins().catch(recover<string[]>('xmtp.groupAdmins', [])),
    conv.listSuperAdmins().catch(recover<string[]>('xmtp.groupAdmins', [])),
  ]);
  return { admins, superAdmins };
}

async function groupMetaPolicyOf(conv: Conversation): Promise<GroupMetaPolicy> {
  if (!(conv instanceof Group)) return UNKNOWN_GROUP_POLICY;
  const set = await conv.permissionPolicySet().catch(recover('xmtp.groupMetaPolicy', null));
  return set ? groupMetaPolicyOfSet(set) : UNKNOWN_GROUP_POLICY;
}

async function streamAllMessages(
  client: NativeClient, onMessage: (m: NativeMessage | undefined) => void, onClose: () => void,
): Promise<() => void> {
  await client.conversations.streamAllMessages(
    (m) => { onMessage(m); return Promise.resolve(); },
    'all',
    VISIBLE_CONSENT,
    onClose,
  );
  return () => {
    attempt(() => { client.conversations.cancelStreamAllMessages(); }, 'cleanup');
  };
}

function streamConversations(client: NativeClient, onConv: (conv: Conversation) => void): () => void {
  let live = true;
  void client.conversations.stream((conv) => { if (live) onConv(conv); return Promise.resolve(); }).catch(reported('xmtp.convStream'));
  return () => {
    live = false;
    attempt(() => { client.conversations.cancelStream(); }, 'cleanup');
  };
}

function streamConsent(client: NativeClient, onChange: () => void): () => void {
  let live = true;
  void client.preferences.streamConsent(() => {
    if (live) onChange();
    return Promise.resolve();
  }).catch(reported('xmtp.consentStream'));
  return () => {
    live = false;
    attempt(() => { client.preferences.cancelStreamConsent(); }, 'cleanup');
  };
}

function streamDeletions(client: NativeClient, onDeleted: (deletion: MessageDeletion) => void): () => void {
  let live = true;
  let cancel: (() => void) | null = null;
  void client.conversations.streamMessageDeletions((messageId, convId) => {
    if (live) onDeleted({ convId, messageId });
    return Promise.resolve();
  }).then((stop) => {
    if (live) cancel = stop;
    else attempt(stop, 'cleanup');
  }).catch(reported('xmtp.deletionStream'));
  return () => {
    live = false;
    if (cancel) attempt(cancel, 'cleanup');
  };
}

async function messageTarget(client: NativeClient, messageId: string): Promise<MessageTarget<Conversation> | null> {
  const message = await client.conversations.findMessage(asMessageId(messageId));
  const convId = message ? convIdFromTopic(message.topic) ?? conversationIdField(message) : undefined;
  const conv = convId ? await client.conversations.findConversation(asConversationId(convId)) : undefined;
  return message && conv ? { conv, contentTypeId: message.contentTypeId } : null;
}

async function keyPackageErrors(_client: NativeClient, installationIds: string[]): Promise<(string | null | undefined)[]> {
  const { statuses } = await staticKeyPackageStatuses('production', installationIds as InstallationIds);
  return [...statuses.values()].map(s => s.validationError);
}

type LogWriterArgs = Parameters<typeof Client.activatePersistentLibXMTPLogWriter>;
const LOG_LEVEL_ERROR = 0 as LogWriterArgs[0];
const LOG_ROTATION_HOURLY = 2 as LogWriterArgs[1];
const LOG_FLUSH_MS = 300;

async function nativeErrorLog(work: () => Promise<unknown>): Promise<string> {
  if (Client.isLogWriterActive()) return pickNativeErrors(await readNativeLogs());
  Client.activatePersistentLibXMTPLogWriter(LOG_LEVEL_ERROR, LOG_ROTATION_HOURLY, 1);
  try {
    await work().catch(ignored(undefined, 'probe'));
    await new Promise((resolve) => setTimeout(resolve, LOG_FLUSH_MS));
  } finally {
    Client.deactivatePersistentLibXMTPLogWriter();
  }
  try {
    return pickNativeErrors(await readNativeLogs());
  } finally {
    Client.clearXMTPLogs();
  }
}

async function readNativeLogs(): Promise<string> {
  const texts = await Promise.all(Client.getXMTPLogFilePaths().map((path) => Client.readXMTPLogFile(path)));
  return texts.join('\n');
}

export const sdk: XmtpSdk<NativeClient, Conversation, NativeMessage> = {
  client: xmtpClient,
  cachedClient: getCachedXmtpClient,
  findConv: (client, convId) => client.conversations.findConversation(asConversationId(convId)),
  listConvs: (client, consent) => client.conversations.list(LIST_OPTIONS, undefined, consent),
  syncConvList: (client) => client.conversations.sync(),
  syncVisible: (client) => client.conversations.syncAllConversations(VISIBLE_CONSENT),
  syncConsent: (client) => client.preferences.syncConsent(),
  openDm: (client, address) => client.conversations.findOrCreateDmWithIdentity(identityOf(address)),
  activeDm: (client, peerInboxId) => client.conversations.findOrCreateDm(peerInboxId),
  dmLookup: (client, address) => {
    const identity = identityOf(address);
    return Promise.resolve({
      find: () => client.conversations.findDmByIdentity(identity),
      peerInboxId: () => client.findInboxIdFromIdentity(identity),
    });
  },
  forceAddMember: (client, convId, inboxId) =>
    addGroupMembers(client.installationId, asConversationId(convId), [inboxId]),
  inboxIdOfAddress: (client, address) => client.findInboxIdFromIdentity(identityOf(address)),
  installationIdsOf: async (client, inboxId) =>
    ((await client.inboxStates(true, [inboxId]))[0]?.installations ?? []).map(i => i.id),
  keyPackageErrors,
  ethAddressesOf: async (client, inboxIds) => {
    const states = await client.inboxStates(true, inboxIds);
    return inboxIds.map((_, i) => states[i]?.identities.find(it => it.kind === 'ETHEREUM')?.identifier);
  },
  newGroup: (client, addresses, meta) => client.conversations.newGroupWithIdentities(identitiesOf(addresses), meta),
  streamAllMessages,
  streamConversations,
  streamConsent,
  streamDeletions,
  deletedEntryOf: () => Promise.resolve(null),
  messageTarget,
  history: {
    sendSyncRequest: (client, serverUrl) => client.sendSyncRequest(serverUrl),
    syncDeviceGroups: (client) => client.syncAllDeviceSyncGroups(),
    processSyncArchive: (client) => client.processSyncArchive(),
    createArchive: (client, key) => archiveToBytes((path) => client.createArchive(path, key, ARCHIVE_OPTIONS)),
    importArchive: (client, archive, key) => archiveFromBytes(archive, (path) => client.importArchive(path, key)),
  },
  nativeErrorLog,
  isGroup: (conv) => conv instanceof Group,
  isActive: (conv) => conv.isActive(),
  syncState: async (conv) => {
    const [info, paused] = await Promise.all([conv.getDebugInformation(), conv.pausedForVersion()]);
    return {
      epoch: info.epoch,
      forked: info.maybeForked || (info.commitLogForkStatus as string) === 'forked',
      forkDetails: info.forkDetails,
      pausedForVersion: paused ?? '',
    };
  },
  dmPeerInboxId: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  groupName: (conv) => (conv instanceof Group ? conv.name().catch(recover('xmtp.groupName', '')) : Promise.resolve('')),
  groupInfo: groupInfoOf,
  groupAdmins: groupAdminsOf,
  groupMetaPolicy: groupMetaPolicyOf,
  groupOps: (conv) => (conv instanceof Group ? conv : null),
  addMembers: (conv, addresses) => asGroup(conv).addMembersByIdentity(identitiesOf(addresses)),
  removeMembers: (conv, addresses) => asGroup(conv).removeMembersByIdentity(identitiesOf(addresses)),
  leaveOp: (conv) => {
    const group = asGroup(conv);
    return () => group.leaveGroup();
  },
  createdAtNs: (conv) => (conv.createdAt ?? 0) * 1_000_000,
  addedByInboxId: (conv) => (conv instanceof Group ? conv.addedByInboxId : undefined),
  consentOf: (conv) => conv.consentState(),
  setConsent: (conv, state) => conv.updateConsent(state),
  messages: (conv, query) => conv.messages(nativeQuery(query)),
  rowOf: (m) => ({
    id: m.id, content: contentOf(m), contentTypeId: m.contentTypeId, senderInboxId: m.senderInboxId, sentNs: m.sentNs,
  }),
  envelopeOf: (m, line) => mapDecodedToEnvelope(m, line),
  sentNsOf: (m) => m.sentNs,
  convIdOf: (m) => convIdFromTopic(m.topic) ?? conversationIdField(m),
  deleteMessage: (conv, messageId) => conv.deleteMessage(asMessageId(messageId)),
  send: {
    text: (conv, text) => conv.send(text),
    reaction: (conv, reaction) => conv.send({ reaction }),
    reply: (conv, replyTo, text) => conv.send({ reply: buildReply(replyTo, text) }),
    json: (conv, codec, content) => conv.send(content, { contentType: codec.contentType }),
  },
};

export const convOfLine = convFinder(sdk);

export const sendableConvOfLine = sendableFinder(sdk);
