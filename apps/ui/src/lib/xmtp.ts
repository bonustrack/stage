
import {
  Client,
  IdentifierKind,
  type Conversation, type Signer, type XmtpEnv,
} from '@xmtp/browser-sdk';
import {
  generatePrivateKey, privateKeyToAccount,
  type PrivateKeyAccount,
} from 'viem/accounts';
import { hexToBytes, type Hex } from 'viem';
import { getHostAccount, hostSigner } from './hostSigner';

export type { XmtpEnv };

const PRIVATE_KEY_KEY = 'xmtp.privateKey';
const ADDRESS_KEY = 'xmtp.address';
const ENV_KEY = 'xmtp.env';

function loadOrCreateAccount(): PrivateKeyAccount {
  const stored = localStorage.getItem(PRIVATE_KEY_KEY);
  if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
    return privateKeyToAccount(stored as Hex);
  }
  const fresh = generatePrivateKey();
  localStorage.setItem(PRIVATE_KEY_KEY, fresh);
  return privateKeyToAccount(fresh);
}

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

export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<XmtpClient> {
  if (cachedClient) return cachedClient;
  if (buildingClient) return buildingClient;
  buildingClient = (async (): Promise<XmtpClient> => {
    const hostAddress = await getHostAccount().catch(() => null);
    let signer: Signer;
    let address: string;
    if (hostAddress) {
      signer = hostSigner(hostAddress);
      address = hostAddress;
    } else {
      const account = loadOrCreateAccount();
      signer = signerForAccount(account);
      address = account.address.toLowerCase();
    }
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    const savedEnv = localStorage.getItem(ENV_KEY);
    const opts = { env } as Parameters<typeof Client.create>[1];
    if (savedAddress?.toLowerCase() === address && savedEnv === env) {
      try {
        cachedClient = await Client.build(
          { identifier: address, identifierKind: IdentifierKind.Ethereum },
          opts,
        );
        return cachedClient;
      } catch { }
    }
    cachedClient = await Client.create(signer, opts);
    localStorage.setItem(ADDRESS_KEY, address);
    localStorage.setItem(ENV_KEY, env);
    return cachedClient;
  })();
  try { return await buildingClient; }
  finally { buildingClient = null; }
}

export function getCachedXmtpClient(): XmtpClient | null { return cachedClient; }

export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function stampAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

export function convIdOfLine(line: string): string | null {
  const m = /^metro:\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

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
} from './xmtpGroups';

export {
  getLastReadNs, setLastReadNs,
  getConvConsent, markConvReadSynced, markConvUnreadSynced,
  syncPreferences, streamConvConsent,
} from './xmtpConsent';
