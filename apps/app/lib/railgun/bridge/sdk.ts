/** @file RN-side generic `sdk(method, args)` dispatcher invoking any whitelisted @railgun-community/wallet op in the embedded Node host; engine ops route to engine.js, everything else to the whitelist, unknown methods reject clearly. */
import { rawCall } from './transport';

/** Engine-init + proof generation can be slow (a Groth16 proof is ~20-30s); give generic SDK calls generous headroom so a real op never false-times-out. Read-only primitives (getAddress, listMethods) return well under this. */
const SDK_TIMEOUT_MS = 90_000;

/** Invoke a whitelisted SDK method by name with positional (JSON-safe) args, returning the host's JSON-serialized result (bigint → decimal string); callers cast to the concrete type they expect. */
export async function sdk<T = unknown>(method: string, args: readonly unknown[] = []): Promise<T> {
  return (await rawCall('sdk', { method, args }, SDK_TIMEOUT_MS)) as T;
}

/** Capability probe: the SDK methods reachable on THIS binary without a rebuild. Lets the RN side feature-gate (e.g. hide unshield if its primitives aren't whitelisted on the installed APK). */
export async function sdkListMethods(): Promise<string[]> {
  return (await rawCall('sdk', { method: 'listMethods', args: [] }, SDK_TIMEOUT_MS)) as string[];
}
