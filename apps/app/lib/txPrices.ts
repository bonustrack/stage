/**
 * @file USD-price layer for the tx/sign cards + simulation asset lines: fetches and briefly caches CoinGecko spot prices (same source as the wallet tab) and exposes a non-blocking hook that turns a token amount into a `~$X` suffix.
 *  Unpriceable tokens (e.g. STAGE) resolve to null and show the amount only — never a fake or zero $; READ-ONLY fetch, no key material.
 */

import { useEffect, useState } from 'react';
import { getSimplePrices, getErc20UsdPrices } from '@stage-labs/client/api/coingecko';
import { priceKeyFor, priceKeyId, type PriceKey } from './txAssets';

/** In-memory price cache keyed by priceKeyId; entries expire after TTL so a long session re-quotes occasionally without hammering CoinGecko. */
const TTL_MS = 60_000;
const cache = new Map<string, { usd: number; at: number }>();
const inflight = new Map<string, Promise<number | null>>();

/** Fetch (and cache) the USD spot price for a resolved PriceKey. Returns null for an unpriceable key, or on any network/parse error (caller shows amount only — never a fake value). Concurrent callers share one in-flight request. */
async function fetchUsdPrice(key: PriceKey): Promise<number | null> {
  const id = priceKeyId(key);
  if (!id || !key) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.usd;
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = (async () => {
    try {
      let usd: number | undefined;
      if (key.kind === 'native') {
        const r = await getSimplePrices([key.cgId]);
        usd = r[key.cgId]?.usd;
      } else {
        const r = await getErc20UsdPrices(key.platform, [key.contract]);
        usd = r[key.contract.toLowerCase()]?.usd;
      }
      if (typeof usd === 'number' && isFinite(usd)) {
        cache.set(id, { usd, at: Date.now() });
        return usd;
      }
      return null;
    } catch {
      return null;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}

/** Format `amount × priceUsd` as a `~$X` suffix string, or null when there's no price. Sub-cent values still render (`~$0.00…` is suppressed -> show < $0.01 as "~$0.01" floor so it never reads as free). */
export function fmtUsdValue(amount: string, priceUsd: number | null): string | null {
  if (priceUsd === null) return null;
  const n = Number(amount);
  if (!isFinite(n) || n === 0) return null;
  const v = n * priceUsd;
  if (v > 0 && v < 0.01) return '~<$0.01';
  const frac = v < 1 ? 4 : 2;
  return `~$${v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: frac })}`;
}

/** React hook: resolve the `~$X` suffix for a single `(chainId, token, amount)`. Non-blocking — returns null until the price resolves; null forever for an unpriceable token. */
export function useUsdValue(
  chainId: number, token: string | null | undefined, amount: string | undefined,
): string | null {
  const [usd, setUsd] = useState<number | null>(null);
  // `id` is the stable identity of the (chainId, token) price source; it drives
  // the effect. `key` is rebuilt from it inside the effect so the dep list stays
  // a single primitive (no object churn).
  const id = priceKeyId(priceKeyFor(chainId, token));
  useEffect(() => {
    if (!id) { setUsd(null); return; }
    let alive = true;
    void fetchUsdPrice(priceKeyFor(chainId, token)).then(p => { if (alive) setUsd(p); });
    return () => { alive = false; };
  }, [id, chainId, token]);
  if (!amount) return null;
  return fmtUsdValue(amount, usd);
}
