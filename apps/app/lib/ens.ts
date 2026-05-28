/** ENS name → address resolution via stamp.fyi.
 *
 *  We can't lean on viem's `getEnsAddress` here because most ENS names now
 *  resolve through CCIP-Read / custom Universal Resolver paths that fall over
 *  in React Native (fetch-from-resolver shape, EIP-3668 retries). stamp.fyi
 *  exposes a server-side `resolve_names` endpoint that already handles all
 *  the offchain dance — same one Snapshot UI uses. */

const STAMP_URL = 'https://stamp.fyi';

/** Resolve a single ENS-style name (already lowercased / normalised by the caller)
 *  to an Ethereum address. Returns `null` when nothing is registered. */
export async function resolveEnsName(name: string): Promise<string | null> {
  const res = await fetch(STAMP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'resolve_names',
      params: [name],
      /** Mainnet ENS only — Metro DMs are always mainnet identities. */
      network: 1,
    }),
  });
  if (!res.ok) throw new Error(`stamp.fyi resolve_names ${res.status}`);
  const body = await res.json() as { result?: Record<string, string> | null };
  const addr = body.result?.[name];
  return typeof addr === 'string' && addr.length === 42 ? addr : null;
}
