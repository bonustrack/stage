/** Embedded-widget signer bridge.
 *
 *  When Metro runs as an iframe inside a host app (e.g. Snapshot), the widget
 *  borrows the host's already-connected wallet to sign XMTP identity operations
 *  instead of minting its own throwaway key. The widget never holds a key: it
 *  proxies sign requests to the parent window over postMessage, and the host
 *  signs with its own wallet provider (wagmi/viem) and posts the signature back.
 *
 *  Host integration contract (the host adds a small listener — see README):
 *    widget → host  { type: 'metro:account-request' }
 *    host  → widget { type: 'metro:account', address }          // connected EOA, or omit/empty to decline
 *    widget → host  { type: 'metro:sign-request', id, message } // personal_sign the string
 *    host  → widget { type: 'metro:sign-response', id, signature }   // 0x… hex
 *                   { type: 'metro:sign-response', id, error }       // user rejected / failed
 *
 *  XMTP only needs real signatures at inbox creation + installation registration,
 *  so the user sees ~1 wallet prompt on first open, then nothing per message. */

import { IdentifierKind, type Signer } from '@xmtp/browser-sdk';
import { hexToBytes, type Hex } from 'viem';
import { runningInIframe } from './embedBridge';

interface Pending {
  resolve: (sig: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, Pending>();
let listening = false;

/** Only trust messages coming from our direct parent frame (the host page). */
function fromParent(e: MessageEvent): boolean {
  return e.source === window.parent && window.parent !== window;
}

/** Lazily attach the single sign-response listener (idempotent). */
function ensureSignListener(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('message', (e: MessageEvent) => {
    if (!fromParent(e)) return;
    const d = e.data as { type?: string; id?: string; signature?: string; error?: string } | null;
    if (d?.type !== 'metro:sign-response' || !d.id) return;
    const p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    clearTimeout(p.timer);
    if (d.error) p.reject(new Error(d.error));
    else if (typeof d.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(d.signature)) p.resolve(d.signature);
    else p.reject(new Error('host returned no signature'));
  });
}

/** Ask the host for its currently-connected wallet address. Resolves null when
 *  not embedded, or when the host doesn't answer within `timeoutMs` (no Metro
 *  bridge / no wallet connected) — callers then fall back to a local key. */
export function getHostAccount(timeoutMs = 4000): Promise<string | null> {
  if (!runningInIframe()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent): void => {
      if (!fromParent(e)) return;
      const d = e.data as { type?: string; address?: string } | null;
      if (d?.type !== 'metro:account') return;
      cleanup();
      resolve(
        typeof d.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(d.address)
          ? d.address.toLowerCase()
          : null,
      );
    };
    const t = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    const cleanup = (): void => { window.removeEventListener('message', onMsg); clearTimeout(t); };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: 'metro:account-request' }, '*');
  });
}

/** Request a personal_sign of `message` from the host wallet. Long timeout —
 *  the user may take a while to approve in their wallet. */
function hostSignMessage(message: string, timeoutMs = 120_000): Promise<string> {
  ensureSignListener();
  const id = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('host signature request timed out'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ type: 'metro:sign-request', id, message }, '*');
  });
}

/** Subscribe to host wallet changes (connect / disconnect / switch). The host
 *  posts `metro:account` with the new address (or empty to signal disconnect).
 *  Returns an unsubscribe fn. */
export function onHostAccountChange(cb: (address: string | null) => void): () => void {
  const onMsg = (e: MessageEvent): void => {
    if (!fromParent(e)) return;
    const d = e.data as { type?: string; address?: string } | null;
    if (d?.type !== 'metro:account') return;
    cb(typeof d.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(d.address) ? d.address.toLowerCase() : null);
  };
  window.addEventListener('message', onMsg);
  return () => window.removeEventListener('message', onMsg);
}

/** XMTP `Signer` backed by the host wallet. `address` comes from getHostAccount(). */
export function hostSigner(address: string): Signer {
  return {
    type: 'EOA',
    getIdentifier: () => ({ identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sigHex = await hostSignMessage(message);
      return hexToBytes(sigHex as Hex);
    },
  };
}
