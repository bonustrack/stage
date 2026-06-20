/** @file ENS name to address resolution via the stamp.fyi server-side `resolve_names` endpoint, which handles the CCIP-Read / Universal Resolver offchain dance that viem's `getEnsAddress` fails on in React Native; pure `fetch`, no platform deps, so it lives in the Stage SDK. */

const STAMP_URL = 'https://stamp.fyi';

/** Resolve a single ENS-style name (already lowercased / normalised by the caller) to an Ethereum address. Returns `null` when nothing is registered. */
export async function resolveEnsName(name: string): Promise<string | null> {
  const res = await fetch(STAMP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'resolve_names',
      params: [name],
      /** Mainnet ENS only: Metro DMs are always mainnet identities. */
      network: 1,
    }),
  });
  if (!res.ok) throw new Error(`stamp.fyi resolve_names ${res.status}`);
  const body = (await res.json()) as { result?: Record<string, string> | null };
  const addr = body.result?.[name];
  return typeof addr === 'string' && addr.length === 42 ? addr : null;
}
