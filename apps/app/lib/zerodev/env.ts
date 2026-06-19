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

/** Read an env var as a trimmed string, or undefined when unset/blank.
 *  process.env is typed `any` here, so the value crosses the boundary as `unknown`
 *  and is narrowed with a typeof guard before use. */
function envString(name: string): string | undefined {
  const value: unknown = process.env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const PROJECT_ID: string = envString('EXPO_PUBLIC_ZERODEV_PROJECT_ID') ?? '';

/** The combined bundler + paymaster RPC URL for Base, or null when the project
 *  id is not configured (the smart-wallet feature then self-gates as
 *  unavailable, same as a missing native module). */
export function zerodevRpcUrl(): string | null {
  const override = envString('EXPO_PUBLIC_ZERODEV_RPC');
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
  return envString('EXPO_PUBLIC_ZERODEV_RP_ID') ?? 'metro.box';
}
