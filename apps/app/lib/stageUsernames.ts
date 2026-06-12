/** App-side glue for Stage usernames (`<name>.stage.eth`).
 *
 *  Wraps the framework-agnostic SDK client (@stage-labs/client/identity/...)
 *  with the app's gateway URL + boot wiring + a tiny "my username" cache. The
 *  gateway URL is the cloudflared tunnel that fronts the daemon usernames train
 *  (same pattern as SWARM_UPLOAD_URL → blob.metro.box). */

import { configureStageUsernames } from '@stage-labs/client/identity/peerProfiles';
import {
  claimName as gwClaim, isNameAvailable as gwAvailable,
  lookupAddress as gwLookupAddress, type ClaimResult,
} from '@stage-labs/client/identity/stageUsernames';
import { claimMessage, type UsernameRecord } from '@stage-labs/client/identity/username';

/** Cloudflared tunnel host for the usernames train. Override via
 *  EXPO_PUBLIC_STAGE_USERNAMES_URL for staging. */
export const STAGE_USERNAMES_URL =
  process.env.EXPO_PUBLIC_STAGE_USERNAMES_URL ?? 'https://usernames.stage.eth';

/** Wire peer-profile resolution to prefer claimed `<name>.stage.eth` names over
 *  ENS. Call once at boot. */
export function initStageUsernames(): void {
  configureStageUsernames(STAGE_USERNAMES_URL);
}

/** True when `name` (a normalised label) is free to claim. */
export function isNameAvailable(name: string): Promise<boolean> {
  return gwAvailable(STAGE_USERNAMES_URL, name);
}

/** The record an address currently owns, or null. */
export function lookupAddress(address: string): Promise<UsernameRecord | null> {
  return gwLookupAddress(STAGE_USERNAMES_URL, address);
}

/** The EIP-191 message + timestamp for a claim — the caller signs `message`
 *  with the wallet, then passes `ts` + signature to {@link submitClaim}. */
export function buildClaim(name: string, address: string): { message: string; ts: number } {
  const ts = Math.floor(Date.now() / 1000);
  return { message: claimMessage(name, address, ts), ts };
}

/** Submit a signed claim to the gateway. */
export function submitClaim(
  name: string, address: string, sig: string, ts: number, avatar?: string,
): Promise<ClaimResult> {
  return gwClaim(STAGE_USERNAMES_URL, { name, address, sig, ts, avatar });
}
