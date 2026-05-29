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
  ConsentState,
  ConsentEntityType,
  type Consent,
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
    /** Embedded in a host app (e.g. Snapshot)? Borrow its connected wallet via the
     *  postMessage bridge so the widget's XMTP identity == the user's wallet, with
     *  no separate connect. Falls back to a local throwaway key on the standalone
     *  site or when the host exposes no wallet. */
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
    /** TS narrows `Omit<ClientOptions, "codecs">` to the `{ backend }` branch when the
     *  literal only contains `env`. Cast to the network-options shape so `env` survives. */
    const opts = { env } as Parameters<typeof Client.create>[1];
    /** Reuse on-disk identity only when both the address (key match) and env
     *  (network match) line up — different networks live under different inboxes.
     *  Reusing skips re-signing — important for the host-wallet path (no extra prompt). */
    if (savedAddress && savedAddress.toLowerCase() === address && savedEnv === env) {
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

export function getCachedXmtpClient(): XmtpClient | null { return cachedClient; }

/** Format a metro-style line URI for an XMTP conversation. */
export function lineOfConv(convId: string): string { return `metro://xmtp/${convId}`; }

/** Pretty-print a wallet address as `0x1234…abcd`. */
export function shortAddress(addr: string): string {
  if (!addr) return '';
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** stamp.fyi avatar URL. `cdn.stamp.box` has no DNS — `stamp.fyi` is the canonical
 *  host. Returns a 200 identicon when no custom avatar exists. `cacheBust` is
 *  appended as `&cb=…` (pass `getCacheHash(profile.avatar)`) so stamp refetches
 *  when the avatar changes instead of serving the previously-cached image. */
export function stampBoxAvatarUrl(address: string, size = 120, cacheBust?: string): string {
  const base = `https://stamp.fyi/avatar/eth:${address.toLowerCase()}?s=${size}`;
  return cacheBust ? `${base}&cb=${encodeURIComponent(cacheBust)}` : base;
}

export { peerEthAddressOfDm, groupMemberEthAddresses, memberInboxToAddressMap } from './xmtpResolve';

/** URI prefix used for inbound XMTP "from" addresses. Mirrors the mobile app. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

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

/** Base URL of the Metro API (daemon-backed). */
export const METRO_API_URL = 'https://api.metro.box';

/** Create the "Ask a question" group via the Metro API so the *daemon* owns it
 *  (daemon = super-admin) and the local user joins as a plain member — rather
 *  than the user creating + owning it client-side. The daemon adds us by
 *  address; we sync the conversation list so the new group resolves locally,
 *  then return its id for navigation. */
export async function createAskQuestionGroup(): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const selfAddr = client.accountIdentifier?.identifier.toLowerCase() ?? '';
  if (!selfAddr) throw new Error('No local XMTP address available.');
  const res = await fetch(`${METRO_API_URL}/ask-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: selfAddr }),
  });
  const json = await res.json().catch(() => ({})) as { conversationId?: string; error?: string };
  if (!res.ok || !json.conversationId) {
    throw new Error(json.error ?? `Could not start the conversation (${res.status}).`);
  }
  /** The daemon created the group + added us; pull it into the local store so
   *  navigation + the conversation view find it immediately. */
  await client.conversations.sync().catch(() => undefined);
  return json.conversationId;
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

/** Cross-device read/unread marker — synced across the inbox's installations via
 *  XMTP's per-conversation consent state. See the matching block in
 *  apps/app/lib/xmtp.ts for the full rationale: XMTP V3 has no arbitrary synced
 *  KV store, so we repurpose the consent `allowed`↔`unknown` axis as a synced
 *  read flag (never `denied`, which would hide the conversation):
 *    - `allowed` → read
 *    - `unknown` → unread
 *  The numeric unread *count* stays per-device (lastReadNs); the binary
 *  read/unread state propagates cross-device. */

/** Map an XMTP `ConsentState` enum to its string form used across the UI. */
function consentStateToString(s: ConsentState): 'allowed' | 'denied' | 'unknown' {
  return s === ConsentState.Allowed ? 'allowed'
    : s === ConsentState.Denied ? 'denied' : 'unknown';
}

/** Read a conversation's synced consent state as a string. */
export async function getConvConsent(convId: string): Promise<'allowed' | 'denied' | 'unknown'> {
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return 'unknown';
    return consentStateToString(await conv.consentState());
  } catch { return 'unknown'; }
}

/** Mark a conversation read across devices: consent → Allowed (synced) + bump
 *  the local lastReadNs so the per-device count clears too. */
export async function markConvReadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, Date.now() * 1_000_000);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Allowed) {
      await conv.updateConsentState(ConsentState.Allowed);
    }
  } catch { /* best-effort — local lastReadNs still cleared the badge */ }
}

/** Mark a conversation unread across devices: consent → Unknown (synced) +
 *  rewind the local lastReadNs so this device shows the badge immediately. */
export async function markConvUnreadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, 0);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Unknown) {
      await conv.updateConsentState(ConsentState.Unknown);
    }
  } catch { /* best-effort */ }
}

/** Pull synced preference/consent updates from the network into the local DB.
 *  Call on mount / tab-visible so consent changes from another device land. */
export async function syncPreferences(): Promise<void> {
  try { await getCachedXmtpClient()?.preferences.sync(); }
  catch { /* best-effort */ }
}

/** Subscribe to cross-device consent changes. Fires `(convId, state)` for every
 *  conversation-scoped consent update. Returns a stop fn. */
export async function streamConvConsent(
  onChange: (convId: string, state: 'allowed' | 'denied' | 'unknown') => void,
): Promise<() => Promise<void>> {
  const client = getCachedXmtpClient();
  if (!client) return async () => undefined;
  const stream = await client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      for (const c of records) {
        if (c.entityType !== ConsentEntityType.GroupId) continue;
        onChange(c.entity, consentStateToString(c.state));
      }
    },
    onError: () => { /* backstops resync */ },
  });
  return async () => { try { await stream.end(); } catch { /* ignore */ } };
}
