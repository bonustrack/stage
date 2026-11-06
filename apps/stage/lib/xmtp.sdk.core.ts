import type { HistoryEntry } from '@stage-labs/client/types';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import type { ReactionPayload } from '@stage-labs/client/xmtp/builders';
import type { GroupMetaPolicy, GroupMetaWriters } from '@stage-labs/client/xmtp/groups';
import type { AppDataGroup } from '@stage-labs/client/xmtp/channelMeta';
import type { JsonCodec } from '@stage-labs/client/xmtp/jsonCodec';
import type { XmtpConsent } from './xmtp.types';

export interface GroupMeta {
  name?: string;
  imageUrl?: string;
  appData?: string;
}

export interface GroupInfo {
  name: string;
  imageUrl: string;
  description: string;
}

export interface GroupAdmins {
  admins: string[];
  superAdmins: string[];
}

export const NO_GROUP_ADMINS: GroupAdmins = { admins: [], superAdmins: [] };

export const NO_GROUP_INFO: GroupInfo = { name: '', imageUrl: '', description: '' };

export const VISIBLE_CONSENT: XmtpConsent[] = ['allowed', 'unknown'];

export function notAGroup(): never {
  throw new Error('Not a channel');
}

export interface ConvLike {
  id: string;
}

export interface MessageQuery {
  limit: number;
  beforeMs?: number;
  beforeNs?: number;
  afterNs?: number;
  insertedAfterNs?: number;
  order?: 'asc' | 'desc';
  filesOnly?: boolean;
}

export interface DmLookup<C> {
  find: () => Promise<C | null | undefined>;
  peerInboxId: () => Promise<string | undefined>;
}

export interface SendOps<C> {
  text: (conv: C, text: string) => Promise<string>;
  reaction: (conv: C, reaction: ReactionPayload) => Promise<string>;
  reply: (conv: C, replyTo: string, text: string) => Promise<string>;
  json: <T>(conv: C, codec: JsonCodec<T>, content: T) => Promise<string>;
}

export interface MessageDeletion {
  convId: string;
  messageId: string;
}

export interface SyncState {
  epoch: number;
  forked: boolean;
  forkDetails: string;
  pausedForVersion: string;
}

export interface MessageTarget<C> {
  conv: C;
  contentTypeId: string;
}

export interface HistoryOps<Cl> {
  sendSyncRequest: (client: Cl, serverUrl: string) => Promise<unknown>;
  syncDeviceGroups: (client: Cl) => Promise<unknown>;
  processSyncArchive: (client: Cl) => Promise<unknown>;
}

interface ClientPrimitives<Cl, C, M> {
  client: () => Promise<Cl>;
  cachedClient: () => Cl | null;
  findConv: (client: Cl, convId: string) => Promise<C | null | undefined>;
  listConvs: (client: Cl, consent?: XmtpConsent[]) => Promise<C[]>;
  syncConvList: (client: Cl) => Promise<unknown>;
  syncVisible: (client: Cl) => Promise<unknown>;
  openDm: (client: Cl, address: string) => Promise<C>;
  activeDm: (client: Cl, peerInboxId: string) => Promise<C>;
  dmLookup: (client: Cl, address: string) => Promise<DmLookup<C> | null>;
  forceAddMember: ((client: Cl, convId: string, inboxId: string) => Promise<unknown>) | null;
  memberInstallationIds: ((conv: C, inboxId: string) => Promise<string[]>) | null;
  inboxIdOfAddress: (client: Cl, address: string) => Promise<string | undefined>;
  installationIdsOf: (client: Cl, inboxId: string) => Promise<string[]>;
  keyPackageErrors: (client: Cl, installationIds: string[]) => Promise<(string | null | undefined)[]>;
  ethAddressesOf: (client: Cl, inboxIds: string[]) => Promise<(string | undefined)[]>;
  newGroup: (client: Cl, addresses: string[], meta: GroupMeta) => Promise<C>;
  streamAllMessages: (client: Cl, onMessage: (m: M | undefined) => void, onClose: () => void) => Promise<() => void>;
  streamConversations: (client: Cl, onConv: (conv: C) => void) => () => void;
  streamConsent: (client: Cl, onChange: (convIds: string[]) => void) => () => void;
  streamPreferences: (client: Cl, onChange: () => void, onClose: () => void) => Promise<() => void>;
  streamDeletions: (client: Cl, onDeleted: (deletion: MessageDeletion) => void) => () => void;
  deletedEntryOf: (client: Cl, messageId: string, line: string) => Promise<HistoryEntry | null>;
  messageTarget: (client: Cl, messageId: string) => Promise<MessageTarget<C> | null>;
  messageById: (client: Cl, messageId: string) => Promise<M | null | undefined>;
  history: HistoryOps<Cl>;
  nativeErrorLog?: (work: () => Promise<unknown>) => Promise<string>;
}

interface ConvPrimitives<C, M> {
  isGroup: (conv: C) => boolean;
  isActive: (conv: C) => Promise<boolean>;
  syncState: (conv: C) => Promise<SyncState>;
  dmPeerInboxId: (conv: C) => (() => Promise<string>) | null;
  groupName: (conv: C) => Promise<string | undefined>;
  groupInfo: (conv: C) => Promise<GroupInfo>;
  groupAdmins: (conv: C) => Promise<GroupAdmins>;
  groupMetaPolicy: (conv: C) => Promise<GroupMetaPolicy>;
  groupOps: (conv: C) => GroupMetaWriters | null;
  appDataGroup: (conv: C) => AppDataGroup | null;
  addMembers: (conv: C, addresses: string[]) => Promise<unknown>;
  removeMembers: (conv: C, addresses: string[]) => Promise<unknown>;
  leaveOp: (conv: C) => (() => Promise<unknown>) | null;
  createdAtNs: (conv: C) => number;
  addedByInboxId: (conv: C) => string | undefined;
  consentOf: (conv: C) => Promise<XmtpConsent>;
  setConsent: (conv: C, state: XmtpConsent) => Promise<unknown>;
  messages: (conv: C, query: MessageQuery) => Promise<M[]>;
  rowOf: (m: M) => StreamedMessage;
  envelopeOf: (m: M, line: string) => HistoryEntry;
  sentNsOf: (m: M) => number;
  convIdOf: (m: M) => string | null | undefined;
  deleteMessage: (conv: C, messageId: string) => Promise<string>;
  send: SendOps<C>;
}

export type XmtpSdk<Cl, C extends ConvLike, M> = ClientPrimitives<Cl, C, M> & ConvPrimitives<C, M>;
