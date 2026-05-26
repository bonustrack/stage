/** Browser XMTP client lifecycle. Web counterpart to apps/app/lib/xmtp.ts.
 *
 *  Auto-mints a viem local wallet on first load and persists the private key in
 *  localStorage (`xmtp.privateKey`) — same identity across reloads. The browser SDK
 *  v7 wants a `Signer` with `getIdentifier` + `signMessage(string) → Uint8Array`,
 *  so we wrap the viem account with a tiny adapter and let `Client.create` run the
 *  one-shot registration handshake. Subsequent boots short-circuit via `Client.build`.
 *
 *  XMTP's local message DB lives in OPFS (per-origin); the SDK manages it for us.
 *  Codecs for text/reaction/reply/attachment are built into the browser SDK so we
 *  don't need to register the codec list the RN SDK requires. */

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

export type { XmtpEnv };

const PRIVATE_KEY_KEY = 'xmtp.privateKey';
const ADDRESS_KEY = 'xmtp.address';
const ENV_KEY = 'xmtp.env';

/** Mint or recover the local viem account. The private key lives in localStorage —
 *  not bulletproof, but matches the mobile app's "throwaway identity" model and
 *  avoids dragging in WalletConnect / browser extension wiring just to send DMs. */
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

/** Generic-erased alias — every method we touch takes/returns the same built-in
 *  content union regardless of the codec list, so the loss is purely cosmetic. */
export type XmtpClient = Client<unknown>;
let cachedClient: XmtpClient | null = null;
let buildingClient: Promise<XmtpClient> | null = null;

/** Lazily build the XMTP client. Returns a singleton across the page lifetime;
 *  concurrent callers share the same in-flight build so we never spawn duplicate
 *  registration handshakes. */
export async function getOrCreateXmtpClient(env: XmtpEnv = 'production'): Promise<XmtpClient> {
  if (cachedClient) return cachedClient;
  if (buildingClient) return buildingClient;
  buildingClient = (async (): Promise<XmtpClient> => {
    const account = loadOrCreateAccount();
    const signer = signerForAccount(account);
    const savedAddress = localStorage.getItem(ADDRESS_KEY);
    const savedEnv = localStorage.getItem(ENV_KEY);
    /** TS narrows `Omit<ClientOptions, "codecs">` to the `{ backend }` branch when the
     *  literal only contains `env`. Cast to the network-options shape so `env` survives. */
    const opts = { env } as Parameters<typeof Client.create>[1];
    /** Reuse on-disk identity only when both the address (key match) and env
     *  (network match) line up — different networks live under different inboxes. */
    if (savedAddress && savedAddress.toLowerCase() === account.address.toLowerCase() && savedEnv === env) {
      try {
        cachedClient = await Client.build(
          { identifier: account.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum },
          opts,
        );
        return cachedClient;
      } catch { /* fall through to create() */ }
    }
    cachedClient = await Client.create(signer, opts);
    localStorage.setItem(ADDRESS_KEY, account.address.toLowerCase());
    localStorage.setItem(ENV_KEY, env);
    return cachedClient;
  })();
  try { return await buildingClient; }
  finally { buildingClient = null; }
}

export function getCachedXmtpClient(): XmtpClient | null { return cachedClient; }

/** Format a metro-style line URI for an XMTP conversation. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** stamp.fyi avatar URL. `cdn.stamp.box` has no DNS — `stamp.fyi` is the canonical
 *  host. Returns a 200 identicon when no custom avatar exists. */
export function stampBoxAvatarUrl(address: string, size = 120): string {
  return `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the mobile app. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

export function isXmtpLine(line: string | undefined | null): boolean {
  return !!line && line.startsWith('metro://xmtp/');
}

export function convIdOfLine(line: string): string | null {
  const m = line.match(/^metro:\/\/xmtp\/([^/]+)$/);
  return m ? m[1] : null;
}

/** Look up an XMTP conversation by metro line URI. */
export async function convOfLine(line: string): Promise<Conversation | null> {
  const convId = convIdOfLine(line);
  if (!convId) return null;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const conv = await client.conversations.getConversationById(convId).catch(() => undefined);
  return conv ?? null;
}

/** Hardcoded co-members for the "Ask a question" group: claude (the daemon's
 *  XMTP identity) + Less (the project owner). The local wallet is added
 *  implicitly as the creator. */
export const ASK_QUESTION_MEMBERS = [
  '0x0bA043c6F25085C68042bad079c29bD8f16a651A', // claude (daemon xmtp train)
  '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5', // Less
] as const;

/** Spin up a 3-party group with the local user, claude, and Less. Filters
 *  out any address that matches the local wallet so testing from one of the
 *  hardcoded co-member accounts doesn't try to add a duplicate member. */
export async function createAskQuestionGroup(): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const selfAddr = client.accountIdentifier?.identifier.toLowerCase()
    ?? '';
  const peers = ASK_QUESTION_MEMBERS
    .filter(a => a.toLowerCase() !== selfAddr)
    .map(a => ({ identifier: a.toLowerCase(), identifierKind: IdentifierKind.Ethereum }));
  /** The browser SDK uses `groupName` (matches the underlying wasm bindings),
   *  while the RN SDK exposes the same field as `name`. */
  const group = await client.conversations.createGroupWithIdentifiers(peers, {
    groupName: 'Ask a question',
  });
  return group.id;
}

/** Drop the local XMTP identity. Next `getOrCreateXmtpClient` mints a fresh wallet. */
export async function resetXmtpClient(): Promise<void> {
  cachedClient?.close();
  cachedClient = null;
  localStorage.removeItem(PRIVATE_KEY_KEY);
  localStorage.removeItem(ADDRESS_KEY);
  localStorage.removeItem(ENV_KEY);
}

/** Find or create a DM with a peer by Ethereum address. Returns the conv id
 *  ready to push into `/xmtp/:convId`. */
export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}

/** Per-conv "last read at" timestamp in XMTP `sentAtNs` units (number, not
 *  bigint — we coerce on read/write). Persisted under `unread.lastRead.<id>`
 *  in localStorage so unread counts survive a reload. */
const LAST_READ_PREFIX = 'unread.lastRead.';
export function getLastReadNs(convId: string): number {
  const raw = localStorage.getItem(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export function setLastReadNs(convId: string, ns: number): void {
  try { localStorage.setItem(LAST_READ_PREFIX + convId, String(ns)); }
  catch { /* quota / private-mode — best effort */ }
}
