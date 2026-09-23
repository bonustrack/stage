import {
  Dm, Group, PublicIdentity, addGroupMembers, staticKeyPackageStatuses,
  type Conversation, type ConversationId,
} from '@xmtp/react-native-sdk';
import { buildReply, buildStaticAttachment } from '@stage-labs/client/xmtp/builders';
import { mapDecodedToEnvelope } from '@stage-labs/client/xmtp/envelope';
import { convIdFromTopic } from '@stage-labs/client/xmtp/clientErrors';
import { xmtpClient } from './xmtp.client';
import { getCachedXmtpClient } from './xmtp.state';
import {
  NO_GROUP_ADMINS, NO_GROUP_INFO, VISIBLE_CONSENT, convFinder, notAGroup,
  type MessageQuery, type XmtpSdk,
} from './xmtp.sdk.core';

type NativeClient = Awaited<ReturnType<typeof xmtpClient>>;
type NativeMessage = Awaited<ReturnType<Conversation['messages']>>[number];
type NativeMessagesOptions = NonNullable<Parameters<Conversation['messages']>[0]>;
type InstallationIds = Parameters<typeof staticKeyPackageStatuses>[1];

const asConversationId = (id: string): ConversationId => id as ConversationId;

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

async function groupInfoOf(conv: Conversation): Promise<{ name: string; imageUrl: string; description: string }> {
  if (!(conv instanceof Group)) return { ...NO_GROUP_INFO };
  const [name, imageUrl, description] = await Promise.all([
    conv.name().catch(() => ''), conv.imageUrl().catch(() => ''), conv.description().catch(() => ''),
  ]);
  return { name, imageUrl, description };
}

async function groupAdminsOf(conv: Conversation): Promise<{ admins: string[]; superAdmins: string[] }> {
  if (!(conv instanceof Group)) return NO_GROUP_ADMINS;
  const [admins, superAdmins] = await Promise.all([
    conv.listAdmins().catch(() => [] as string[]),
    conv.listSuperAdmins().catch(() => [] as string[]),
  ]);
  return { admins, superAdmins };
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
    try { client.conversations.cancelStreamAllMessages(); } catch { }
  };
}

function streamConversations(client: NativeClient, onConv: (conv: Conversation) => void): () => void {
  let live = true;
  void client.conversations.stream((conv) => { if (live) onConv(conv); return Promise.resolve(); }).catch(() => undefined);
  return () => {
    live = false;
    try { client.conversations.cancelStream(); } catch { }
  };
}

function streamConsent(client: NativeClient, onChange: () => void): () => void {
  let live = true;
  void client.preferences.streamConsent(() => {
    if (live) onChange();
    return Promise.resolve();
  }).catch(() => undefined);
  return () => {
    live = false;
    try { client.preferences.cancelStreamConsent(); } catch { }
  };
}

async function keyPackageErrors(_client: NativeClient, installationIds: string[]): Promise<(string | null | undefined)[]> {
  const { statuses } = await staticKeyPackageStatuses('production', installationIds as InstallationIds);
  return [...statuses.values()].map(s => s.validationError);
}

export const sdk: XmtpSdk<NativeClient, Conversation, NativeMessage> = {
  client: xmtpClient,
  cachedClient: getCachedXmtpClient,
  findConv: (client, convId) => client.conversations.findConversation(asConversationId(convId)),
  listConvs: (client, consent) => (consent
    ? client.conversations.list(undefined, undefined, consent)
    : client.conversations.list()),
  syncConvList: (client) => client.conversations.sync(),
  syncVisible: (client) => client.conversations.syncAllConversations(VISIBLE_CONSENT),
  syncConsent: (client) => client.preferences.syncConsent(),
  openDm: (client, address) => client.conversations.findOrCreateDmWithIdentity(identityOf(address)),
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
  history: {
    sendSyncRequest: (client) => client.sendSyncRequest(),
    sendSyncArchive: (client, pin, serverUrl) => client.sendSyncArchive(pin, serverUrl),
    syncDeviceGroups: (client) => client.syncAllDeviceSyncGroups(),
    countArchives: async (client, lookbackDays) => (await client.listAvailableArchives(lookbackDays)).length,
    processSyncArchive: (client, pin) => client.processSyncArchive(pin),
  },
  isGroup: (conv) => conv instanceof Group,
  dmPeerInboxId: (conv) => (conv instanceof Dm ? () => conv.peerInboxId() : null),
  groupName: (conv) => (conv instanceof Group ? conv.name().catch(() => '') : Promise.resolve('')),
  groupInfo: groupInfoOf,
  groupAdmins: groupAdminsOf,
  groupOps: (conv) => (conv instanceof Group ? conv : null),
  addMembers: (conv, addresses) => asGroup(conv).addMembersByIdentity(identitiesOf(addresses)),
  removeMembers: (conv, addresses) => asGroup(conv).removeMembersByIdentity(identitiesOf(addresses)),
  leaveOp: (conv) => {
    const group = asGroup(conv);
    return () => group.leaveGroup();
  },
  createdAtNs: (conv) => (conv.createdAt ?? 0) * 1_000_000,
  consentOf: (conv) => conv.consentState(),
  setConsent: (conv, state) => conv.updateConsent(state),
  messages: (conv, query) => conv.messages(nativeQuery(query)),
  rowOf: (m) => ({
    id: m.id, content: contentOf(m), contentTypeId: m.contentTypeId, senderInboxId: m.senderInboxId, sentNs: m.sentNs,
  }),
  envelopeOf: (m, line) => mapDecodedToEnvelope(m, line),
  sentNsOf: (m) => m.sentNs,
  sentNsText: (m) => String(m.sentNs),
  convIdOf: (m) => convIdFromTopic(m.topic) ?? conversationIdField(m),
  send: {
    text: (conv, text) => conv.send(text),
    reaction: (conv, reaction) => conv.send({ reaction }),
    reply: (conv, replyTo, text) => conv.send({ reply: buildReply(replyTo, text) }),
    json: (conv, codec, content) => conv.send(content, { contentType: codec.contentType }),
    attachment: (conv, filename, mimeType, dataB64) =>
      conv.send({ attachment: buildStaticAttachment(filename, mimeType, dataB64) }),
  },
};

export const convOfLine = convFinder(sdk);
