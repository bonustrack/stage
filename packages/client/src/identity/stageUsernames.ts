/** Client for the Stage username registration gateway (the CCIP-Read gateway's
 *  sibling registration API). Pure `fetch`, no platform deps - lives in the SDK
 *  so both web + mobile share it.
 *
 *  The gateway base URL is configurable. In production it is the cloudflared
 *  tunnel host that fronts the gateway train (e.g. https://usernames.stage.eth);
 *  callers pass it in (the app reads it from config). All endpoints are keyless
 *  and CORS-open; the only auth is the wallet signature inside the claim body.
 *
 *  Endpoints (implemented by packages/metro/src/stations/usernames):
 *    GET  /name/:name          -> 200 {record} | 404 {error:'not found'}
 *    GET  /address/:address    -> 200 {record} | 404 (reverse: addr -> name)
 *    POST /claim {name,address,avatar?,sig,ts} -> 200 {record} | 409 taken | 400 bad
 *  (CCIP-Read resolver endpoint /:sender/:data lives in the same train but is
 *   consumed by the resolver contract, not this client.) */

import type { UsernameRecord } from './username.js';

/** Trim a trailing slash so callers can pass either form. */
function base(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Look up the record for a label (e.g. `alice`). Returns null if unclaimed. */
export async function lookupName(
  gatewayUrl: string,
  name: string,
): Promise<UsernameRecord | null> {
  const res = await fetch(`${base(gatewayUrl)}/name/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gateway /name ${res.status}`);
  return (await res.json()) as UsernameRecord;
}

/** Reverse lookup: the name claimed by an address (lower-cased). Null if none. */
export async function lookupAddress(
  gatewayUrl: string,
  address: string,
): Promise<UsernameRecord | null> {
  const res = await fetch(`${base(gatewayUrl)}/address/${encodeURIComponent(address.toLowerCase())}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`gateway /address ${res.status}`);
  return (await res.json()) as UsernameRecord;
}

/** Availability pre-check: true when the label is free to claim. (Charset /
 *  reserved validation is done client-side via {@link validateName} first.) */
export async function isNameAvailable(gatewayUrl: string, name: string): Promise<boolean> {
  return (await lookupName(gatewayUrl, name)) === null;
}

export interface ClaimInput {
  name: string;
  address: string;
  avatar?: string;
  /** EIP-191 signature over claimMessage(name,address,ts). */
  sig: string;
  ts: number;
}

export type ClaimResult =
  | { ok: true; record: UsernameRecord }
  | { ok: false; status: number; error: string };

/** Register a claim against the gateway. The gateway re-validates the name AND
 *  recovers the signer from `sig`, rejecting if it doesn't match `address`. */
export async function claimName(gatewayUrl: string, input: ClaimInput): Promise<ClaimResult> {
  const res = await fetch(`${base(gatewayUrl)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.ok) return { ok: true, record: (await res.json()) as UsernameRecord };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, status: res.status, error: body.error ?? `gateway ${res.status}` };
}
