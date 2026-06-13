/** ZeroDev project configuration, read from the build-time public env.
 *
 *  The ZeroDev RPC (combined bundler + paymaster URL) is a PUBLIC client
 *  identifier, like the WalletConnect projectId — it is NOT a secret. But we do
 *  NOT hardcode it: it points at a billed paymaster, so it lives in env and the
 *  project + gas policy are provisioned in the ZeroDev dashboard (see the PR).
 *
 *  EXPO_PUBLIC_ZERODEV_PROJECT_ID — the ZeroDev project id (Base, 8453).
 *  EXPO_PUBLIC_ZERODEV_RPC        — optional explicit RPC override; when unset we
 *                                   build the standard ZeroDev RPC URL from the
 *                                   project id. */

const PROJECT_ID = process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID?.trim() || '';

/** The combined bundler + paymaster RPC URL for Base, or null when the project
 *  id is not configured (the smart-wallet feature then self-gates as
 *  unavailable, same as a missing native module). */
export function zerodevRpcUrl(): string | null {
  const override = process.env.EXPO_PUBLIC_ZERODEV_RPC?.trim();
  if (override) return override;
  if (!PROJECT_ID) return null;
  // Standard ZeroDev RPC shape: https://rpc.zerodev.app/api/v3/<projectId>/chain/<chainId>
  return `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/8453`;
}

/** True when a ZeroDev project is configured (RPC resolvable). */
export function zerodevConfigured(): boolean {
  return zerodevRpcUrl() != null;
}

/** Passkey relying-party id — the hosted domain that owns the WebAuthn
 *  credentials (must match the app's associated-domains entitlement). Defaults
 *  to the public app domain; override with EXPO_PUBLIC_ZERODEV_RP_ID. */
export function zerodevRpId(): string {
  return process.env.EXPO_PUBLIC_ZERODEV_RP_ID?.trim() || 'metro.box';
}
