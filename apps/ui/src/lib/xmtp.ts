/**
 * @file Browser XMTP client lifecycle for the web app: auto-minted viem wallet, localStorage-persisted key, and the create/build registration handshake.
 */

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

/** Mint or recover the local viem account. The private key lives in localStorage — not bulletproof, but matches the mobile app's "throwaway identity" model and avoids dragging in WalletConnect / browser extension wiring just to send DMs. */
function loadOrCreateAccount(): PrivateKeyAccount {
  const stored = localStorage.getItem(PRIVATE_KEY_KEY);
  if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
    return privateKeyToAccount(stored as Hex);
  }
  const fresh = generatePrivateKey();
  localStorage.setItem(PRIVATE_KEY_KEY, fresh);
  return privateKeyToAccount(fresh);
}

/** Signer For Account. */
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

/** Generic-erased alias — every method we touch takes/returns the same built-in content union regardless of the codec list, so the loss is purely cosmetic. */
export type XmtpClient = Client<unknown>;
let cachedClient: XmtpClient | null = null;
let buildingClient: Promise<XmtpClient> | null = null;

/** Lazily build the XMTP client. Returns a singleton across the page lifetime; concurrent callers share the same in-flight build so we never spawn duplicate registration handshakes. */
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<XmtpClient> {
  if (cachedClient) return cachedClient;
  if (buildingClient) return buildingClient;
  buildingClient = (async (): Promise<XmtpClient> => {
    /**
     * Embedded in a host app (e.g. Snapshot)? Borrow its connected wallet via the
     *  postMessage bridge so the widget's XMTP identity == the user's wallet, with
     *  no separate connect. Falls back to a local throwaway key on the standalone
     *  site or when the host exposes no wallet.
     */
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
    /** TS narrows `Omit<ClientOptions, "codecs">` to the `{ backend }` branch when the literal only contains `env`. Cast to the network-options shape so `env` survives. */
    const opts = { env } as Parameters<typeof Client.create>[1];
    /** Reuse on-disk identity only when both the address (key match) and env (network match) line up — different networks live under different inboxes. Reusing skips re-signing — important for the host-wallet path (no extra prompt). */
    if (savedAddress?.toLowerCase() === address && savedEnv === env) {
      try {
        cachedClient = await Client.build(
          { identifier: address, identifierKind: IdentifierKind.Ethereum },
          opts,
        );
        return cachedClient;
      } catch { /* fall through to create() */ }
    }
    cachedClient = await Client.create(signer, opts);
    localStorage.setItem(ADDRESS_KEY, address);
    localStorage.setItem(ENV_KEY, env);
    return cachedClient;
  })();
  try { return await buildingClient; }
  finally { buildingClient = null; }
}

/** Return the already-built XMTP client if one exists, else null. */
export function getCachedXmtpClient(): XmtpClient | null { return cachedClient; }

/** Format a metro-style line URI for an XMTP conversation. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/**
 * stamp.fyi avatar URL. `cdn.stamp.box` has no DNS — `stamp.fyi` is the canonical
 *  host. Returns a 200 identicon when no custom avatar exists. `cacheBust` is
 *  appended as `&cb=…` (pass `getCacheHash(profile.avatar)`) so stamp refetches
 *  when the avatar changes instead of serving the previously-cached image.
 */
export function stampAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the mobile app. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

/** Extract the conversation id from a metro XMTP line URI, or null when it doesn't match. */
export function convIdOfLine(line: string): string | null {
  const m = /^metro:\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

/** Look up an XMTP conversation by metro line URI. */
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
