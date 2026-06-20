
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

function fromParent(e: MessageEvent): boolean {
  return e.source === window.parent && window.parent !== window;
}

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
