/** SIWE flow for the metro.box widget + standalone web app.
 *  Talks to `POST /api/auth/siwe` (PR #67) and persists the resulting JWT in localStorage. */

import { SiweMessage } from 'siwe';

const JWT_KEY = 'metro:jwt';
const SUB_KEY = 'metro:sub';

/** Minimal EIP-1193 surface — just `request`. Avoids pulling in viem/wagmi. */
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}
declare global { interface Window { ethereum?: Eip1193 } }

export interface AuthSession {
  jwt: string;
  sub: string;
  expiresAt: number;
}

const sessionKey = (): string | null => localStorage.getItem(JWT_KEY);

/** Decode a JWT payload (no signature check — the daemon owns verification). */
function decodeJwtPayload(jwt: string): { sub?: string; exp?: number } {
  try {
    const [, payload] = jwt.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string; exp?: number };
  } catch { return {}; }
}

export function loadSession(): AuthSession | null {
  const jwt = sessionKey();
  const sub = localStorage.getItem(SUB_KEY);
  if (!jwt || !sub) return null;
  const { exp } = decodeJwtPayload(jwt);
  if (!exp || exp * 1000 < Date.now()) {
    localStorage.removeItem(JWT_KEY); localStorage.removeItem(SUB_KEY);
    return null;
  }
  return { jwt, sub, expiresAt: exp * 1000 };
}

export function clearSession(): void {
  localStorage.removeItem(JWT_KEY); localStorage.removeItem(SUB_KEY);
}

/** Run the SIWE handshake: connect wallet, build message, sign, hit /api/auth/siwe, persist JWT. */
export async function signIn(daemonUrl: string): Promise<AuthSession> {
  if (!window.ethereum) throw new Error('no Ethereum wallet detected');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
  const address = accounts[0];
  if (!address) throw new Error('wallet returned no accounts');
  const chainId = Number(await window.ethereum.request({ method: 'eth_chainId' }) as string);
  const message = new SiweMessage({
    domain: window.location.host,
    address,
    statement: 'Sign in to Metro to chat with the team.',
    uri: window.location.origin,
    version: '1',
    chainId: Number.isFinite(chainId) ? chainId : 1,
    nonce: Math.random().toString(36).slice(2, 18),
    issuedAt: new Date().toISOString(),
  });
  const prepared = message.prepareMessage();
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [prepared, address],
  }) as string;
  const res = await fetch(`${daemonUrl.replace(/\/$/, '')}/api/auth/siwe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prepared, signature }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `siwe failed (${res.status})`);
  }
  const { jwt, sub, expiresIn } = await res.json() as { jwt: string; sub: string; expiresIn: number };
  localStorage.setItem(JWT_KEY, jwt);
  localStorage.setItem(SUB_KEY, sub);
  return { jwt, sub, expiresAt: Date.now() + expiresIn * 1000 };
}
