import type { HistoryEntry } from '@stage-labs/client/types';
import type { StreamedMessage } from '@stage-labs/client/xmtp/summarizeRow';
import type { ReactionPayload } from '@stage-labs/client/xmtp/builders';
import type { GroupMetaPolicy, GroupMetaWriters } from '@stage-labs/client/xmtp/groups';
import type { JsonCodec } from './xmtpJsonCodecs';
import { INACTIVE_SEND_MESSAGE, readableSendError } from '@stage-labs/client/xmtp/clientErrors';
import { convIdOfLine, type XmtpConsent } from './xmtp.types';
import { registerDmRoute } from './dmRoutes';
import { recover } from './errorPolicy';

export interface GroupMeta { name?: string; imageUrl?: string }

export interface GroupInfo { name: string; imageUrl: string; description: string }

export interface GroupAdmins { admins: string[]; superAdmins: string[] }

export const NO_GROUP_ADMINS: GroupAdmins = { admins: [], superAdmins: [] };

export const NO_GROUP_INFO: GroupInfo = { name: '', imageUrl: '', description: '' };

export const VISIBLE_CONSENT: XmtpConsent[] = ['allowed', 'unknown'];

export function notAGroup(): never {
  throw new Error('Not a group conversation');
}

export interface ClientLike { inboxId: string | undefined }

export interface ConvLike {
  id: string;
  sync: () => Promise<unknown>;
  members: () => Promise<{ inboxId: string }[]>;
}

export interface MessageQuery { limit: number; beforeMs?: number; order?: 'asc' | 'desc' }

export interface DmLookup<C> {
  find: () => Promise<C | null | undefined>;
  peerInboxId: () => Promise<string | undefined>;
}

export interface SendOps<C> {
  text: (conv: C, text: string) => Promise<string>;
  reaction: (conv: C, reaction: ReactionPayload) => Promise<string>;
  reply: (conv: C, replyTo: string, text: string) => Promise<string>;
  json: <T>(conv: C, codec: JsonCodec<T>, content: T) => Promise<string>;
  attachment: (conv: C, filename: string, mimeType: string, dataB64: string) => Promise<string>;
}

export interface HistoryOps<Cl> {
  sendSyncRequest: (client: Cl, serverUrl: string) => Promise<unknown>;
  syncDeviceGroups: (client: Cl) => Promise<unknown>;
  processSyncArchive: (client: Cl) => Promise<unknown>;
  createArchive: (client: Cl, key: Uint8Array) => Promise<Uint8Array>;
  importArchive: (client: Cl, archive: Uint8Array, key: Uint8Array) => Promise<unknown>;
}

interface ClientPrimitives<Cl, C, M> {
  client: () => Promise<Cl>;
  cachedClient: () => Cl | null;
  findConv: (client: Cl, convId: string) => Promise<C | null | undefined>;
  listConvs: (client: Cl, consent?: XmtpConsent[]) => Promise<C[]>;
  syncConvList: (client: Cl) => Promise<unknown>;
  syncVisible: (client: Cl) => Promise<unknown>;
  syncConsent: (client: Cl) => Promise<unknown>;
  openDm: (client: Cl, address: string) => Promise<C>;
  activeDm: (client: Cl, peerInboxId: string) => Promise<C>;
  dmLookup: (client: Cl, address: string) => Promise<DmLookup<C> | null>;
  forceAddMember: ((client: Cl, convId: string, inboxId: string) => Promise<unknown>) | null;
  inboxIdOfAddress: (client: Cl, address: string) => Promise<string | undefined>;
  installationIdsOf: (client: Cl, inboxId: string) => Promise<string[]>;
  keyPackageErrors: (client: Cl, installationIds: string[]) => Promise<(string | null | undefined)[]>;
  ethAddressesOf: (client: Cl, inboxIds: string[]) => Promise<(string | undefined)[]>;
  newGroup: (client: Cl, addresses: string[], meta: GroupMeta) => Promise<C>;
  streamAllMessages: (client: Cl, onMessage: (m: M | undefined) => void, onClose: () => void) => Promise<() => void>;
  streamConversations: (client: Cl, onConv: (conv: C) => void) => () => void;
  streamConsent: (client: Cl, onChange: () => void) => () => void;
  history: HistoryOps<Cl>;
}

interface ConvPrimitives<C, M> {
  isGroup: (conv: C) => boolean;
  isActive: (conv: C) => Promise<boolean>;
  dmPeerInboxId: (conv: C) => (() => Promise<string>) | null;
  groupName: (conv: C) => Promise<string | undefined>;
  groupInfo: (conv: C) => Promise<GroupInfo>;
  groupAdmins: (conv: C) => Promise<GroupAdmins>;
  groupMetaPolicy: (conv: C) => Promise<GroupMetaPolicy>;
  groupOps: (conv: C) => GroupMetaWriters | null;
  addMembers: (conv: C, addresses: string[]) => Promise<unknown>;
  removeMembers: (conv: C, addresses: string[]) => Promise<unknown>;
  leaveOp: (conv: C) => (() => Promise<unknown>) | null;
  createdAtNs: (conv: C) => number;
  consentOf: (conv: C) => Promise<XmtpConsent>;
  setConsent: (conv: C, state: XmtpConsent) => Promise<unknown>;
  messages: (conv: C, query: MessageQuery) => Promise<M[]>;
  rowOf: (m: M) => StreamedMessage;
  envelopeOf: (m: M, line: string) => HistoryEntry;
  sentNsOf: (m: M) => number;
  sentNsText: (m: M) => string;
  convIdOf: (m: M) => string | null | undefined;
  send: SendOps<C>;
}

export type XmtpSdk<Cl extends ClientLike, C extends ConvLike, M> = ClientPrimitives<Cl, C, M> & ConvPrimitives<C, M>;

export function convFinder<Cl extends ClientLike, C extends ConvLike, M>(
  sdk: XmtpSdk<Cl, C, M>,
): (line: string) => Promise<C | null> {
  return async (line) => {
    const convId = convIdOfLine(line);
    if (!convId) return null;
    const client = await sdk.client();
    const conv = await sdk.findConv(client, convId).catch(recover('xmtp.findConv', null));
    return conv ?? null;
  };
}

export function sendableFinder<Cl extends ClientLike, C extends ConvLike, M>(
  sdk: XmtpSdk<Cl, C, M>,
): (line: string) => Promise<C> {
  const find = convFinder(sdk);
  return async (line) => {
    const conv = await find(line);
    if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
    if (await sdk.isActive(conv).catch(recover('xmtp.isActive', true))) return conv;
    const peerInboxId = sdk.dmPeerInboxId(conv);
    if (!peerInboxId) throw new Error(INACTIVE_SEND_MESSAGE);
    const active = await sdk.activeDm(await sdk.client(), await peerInboxId());
    registerDmRoute(active.id, convIdOfLine(line) ?? conv.id);
    return active;
  };
}

export async function withReadableSendError<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (err) {
    throw readableSendError(err);
  }
}
