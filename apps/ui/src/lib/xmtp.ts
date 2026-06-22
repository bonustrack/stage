
import {
  Client,
  IdentifierKind,
  type Conversation, type Signer, type XmtpEnv,
} from '@xmtp/browser-sdk';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { hexToBytes } from 'viem';
import { getHostAccount, hostSigner } from './hostSigner';
import {
  getActiveAccount, getActiveAccountId as getActiveAccountIdRaw,
  setActiveAccountId, removeAccountRecord, loadPk, bumpAccountEpoch,
  type AccountRecord,
} from './accounts';
import { dbDirFor } from '@stage-labs/client/accounts/registry';
import {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
} from '@stage-labs/client/xmtp/line';
import { shortAddress } from '@stage-labs/client/identity/format';
import { POLL_CODEC } from './xmtpPollCodec';

export type { XmtpEnv };

export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
  shortAddress,
};

const ADDRESS_PREFIX = 'xmtp.address.';
const ENV_PREFIX = 'xmtp.env.';
const GLOBAL_ENV_KEY = 'xmtp.env';
const HOST_ACCOUNT_ID = 'host';

export {
  listAccounts, bumpAccountEpoch,
  addGeneratedAccount, importPrivateKey, importFromSeed, accountEpoch,
} from './accounts';
export { getActiveAccount };
export type { AccountRecord };

export function getActiveAccountId(): Promise<string | null> {
  return getActiveAccountIdRaw();
}

function addressKeyFor(id: string): string { return ADDRESS_PREFIX + id; }
function envKeyFor(id: string): string { return ENV_PREFIX + id; }

function signerForAccount(account: PrivateKeyAccount): Signer {
  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sigHex = await account.signMessage({ message });
      return hexToBytes(sigHex);
    },
  };
}

export type XmtpClient = Client<unknown>;
let cachedClient: XmtpClient | null = null;
let buildingClient: Promise<XmtpClient> | null = null;

interface ResolvedIdentity {
  id: string;
  address: string;
  signer: Signer;
}

async function resolveIdentity(): Promise<ResolvedIdentity> {
  const hostAddress = await getHostAccount().catch(() => null);
  if (hostAddress) {
    return { id: HOST_ACCOUNT_ID, address: hostAddress, signer: hostSigner(hostAddress) };
  }
  let active = await getActiveAccount();
  if (!active) {
    const { addGeneratedAccount } = await import('./accounts');
    active = await addGeneratedAccount();
  }
  const pk = loadPk(active.id);
  if (!pk) throw new Error('Active account has no stored key.');
  const account = privateKeyToAccount(pk);
  await setActiveAccountId(active.id);
  return { id: active.id, address: account.address.toLowerCase(), signer: signerForAccount(account) };
}

async function buildClientForIdentity(ident: ResolvedIdentity, env: XmtpEnv): Promise<XmtpClient> {
  const dbPath = `${dbDirFor(ident.id)}-${env}.db3`;
  const opts = { env, dbPath, codecs: [POLL_CODEC] } as Parameters<typeof Client.create>[1];
  const savedAddress = localStorage.getItem(addressKeyFor(ident.id));
  const savedEnv = localStorage.getItem(envKeyFor(ident.id));
  if (savedAddress?.toLowerCase() === ident.address && savedEnv === env) {
    try {
      return await Client.build(
        { identifier: ident.address, identifierKind: IdentifierKind.Ethereum },
        opts,
      );
    } catch { }
  }
  const client = await Client.create(ident.signer, opts);
  localStorage.setItem(addressKeyFor(ident.id), ident.address);
  localStorage.setItem(envKeyFor(ident.id), env);
  localStorage.setItem(GLOBAL_ENV_KEY, env);
  return client;
}

export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<XmtpClient> {
  if (cachedClient) return cachedClient;
  if (buildingClient) return buildingClient;
  buildingClient = (async (): Promise<XmtpClient> => {
    const ident = await resolveIdentity();
    cachedClient = await buildClientForIdentity(ident, env);
    return cachedClient;
  })();
  try { return await buildingClient; }
  finally { buildingClient = null; }
}

function disposeCachedClient(): void {
  const client = cachedClient;
  cachedClient = null;
  buildingClient = null;
  if (client) { try { client.close(); } catch { } }
}

export async function switchToAccount(id: string, env: XmtpEnv = getXmtpEnv()): Promise<XmtpClient> {
  await setActiveAccountId(id);
  disposeCachedClient();
  const { resetClientScopedState } = await import('./xmtpClientState');
  resetClientScopedState();
  bumpAccountEpoch();
  return getOrCreateXmtpClient(env);
}

export async function removeAccount(id: string): Promise<AccountRecord[]> {
  const wasActive = (await getActiveAccountIdRaw()) === id;
  const next = await removeAccountRecord(id);
  localStorage.removeItem(addressKeyFor(id));
  localStorage.removeItem(envKeyFor(id));
  if (wasActive) {
    disposeCachedClient();
    const { resetClientScopedState } = await import('./xmtpClientState');
    resetClientScopedState();
    bumpAccountEpoch();
  }
  return next;
}

export function getCachedXmtpClient(): XmtpClient | null { return cachedClient; }

export function getXmtpEnv(): XmtpEnv {
  const saved = localStorage.getItem(GLOBAL_ENV_KEY);
  return (saved as XmtpEnv | null) ?? 'production';
}

export interface XmtpInstallationView {
  id: string;
  createdAtMs: number | null;
  current: boolean;
}

export interface XmtpAccountInfo {
  accountId: string | null;
  address: string;
  inboxId: string;
  installationId: string;
  env: XmtpEnv;
  installations: XmtpInstallationView[];
}

export async function getXmtpAccountInfo(): Promise<XmtpAccountInfo> {
  const env = getXmtpEnv();
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient(env);
  const accountId = await getActiveAccountIdRaw();
  const address = client.accountIdentifier?.identifier ?? '';
  const inboxId = client.inboxId ?? '';
  const installationId = client.installationId ?? '';
  let installations: XmtpInstallationView[] = [];
  try {
    const state = await client.preferences.inboxState();
    installations = state.installations.map(inst => ({
      id: inst.id,
      createdAtMs: inst.clientTimestampNs != null
        ? Number(inst.clientTimestampNs / 1_000_000n)
        : null,
      current: inst.id === installationId,
    }));
  } catch { }
  return { accountId, address, inboxId, installationId, env, installations };
}

export function stampAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const conv = await client.conversations.getConversationById(convId).catch(() => undefined);
  return conv ?? null;
}

export {
  ASK_QUESTION_MEMBERS, METRO_API_URL,
  createAskQuestionGroup, openDmWithAddress,
  createGroup, addGroupMembers,
} from './xmtpGroups';

export {
  getLastReadNs, setLastReadNs,
  getConvConsent, markConvReadSynced, markConvUnreadSynced,
  syncPreferences, streamConvConsent,
} from './xmtpConsent';
