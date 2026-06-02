/** RN-side generic RAILGUN SDK dispatcher client.
 *
 *  This is the GENERIC, future-proof surface: `sdk(method, args)` invokes any
 *  whitelisted @railgun-community/wallet operation in the embedded Node host
 *  (see nodejs-assets/nodejs-project/sdkDispatch.js). Because the whitelist
 *  already covers the full private-transfer surface (wallet mgmt, balances, gas
 *  estimation, proof generation, tx population), phases 3-5 (shield / send /
 *  unshield) can be built as PURE RN orchestration here — NO further APK build.
 *
 *  Typed wrappers for the common ops live alongside `sdk()`; add shield/send/
 *  unshield as thin functions that compose `sdk('gas.*')` → `sdk('proof.*')` →
 *  `sdk('tx.populate*')` and sign+broadcast on RN. Each step is one `sdk()` call.
 *
 *  Methods route in the host as: stateful engine ops (initEngine / getAddress /
 *  balances / engineStatus / listMethods) → engine.js; everything else → the
 *  whitelist. Unknown methods reject with a clear "needs a whitelist add" error
 *  so an unsupported primitive is a visible error, not a silent hang. */
import { rawCall } from './index';

/** Engine-init + proof generation can be slow (a Groth16 proof is ~20-30s);
 *  give generic SDK calls generous headroom so a real op never false-times-out.
 *  Read-only primitives (getAddress, listMethods) return well under this. */
const SDK_TIMEOUT_MS = 90_000;

/** Invoke a whitelisted SDK method by name with positional args. The result is
 *  whatever the SDK fn returns, JSON-serialized (bigint → decimal string) by the
 *  host. Generic by design: callers cast to the concrete result they expect.
 *
 *  @param method stable RN-facing name, e.g. 'wallet.getAddress', 'gas.estimateShield'.
 *  @param args   positional args forwarded to the SDK fn (must be JSON-safe). */
export async function sdk<T = unknown>(method: string, args: readonly unknown[] = []): Promise<T> {
  return (await rawCall('sdk', { method, args }, SDK_TIMEOUT_MS)) as T;
}

/** Capability probe: the SDK methods reachable on THIS binary without a rebuild.
 *  Lets the RN side feature-gate (e.g. hide unshield if its primitives aren't
 *  whitelisted on the installed APK). */
export async function sdkListMethods(): Promise<string[]> {
  return (await rawCall('sdk', { method: 'listMethods', args: [] }, SDK_TIMEOUT_MS)) as string[];
}
