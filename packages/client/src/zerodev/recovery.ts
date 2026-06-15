/** Pure guardian / social-recovery rules for the ZeroDev smart-account wallet —
 *  framework-agnostic, viem-only. The host (apps/app/lib/zerodev/recovery) does
 *  the on-chain IO + XMTP handoff; the threshold math, the recovery-request /
 *  approval message protocol, and the canonical encodings live here so they have
 *  one source of truth (mirrors ./config + ./derive).
 *
 *  See docs/zerodev-wallet-spec.md §(d) + review items 2 & 3. Two locked
 *  decisions baked in here:
 *    - Anti-rounding threshold (review item 3): every guardian gets weight 1 and
 *      threshold = M (integer). No floor(100/N)/ceil math, so M honest guardians
 *      can never fall just short of an unreachable percentage threshold.
 *    - Native timelock (§(d) + the WeightedECDSAValidator `_delay` field): the
 *      delay is a config value here; the validator enforces the window on-chain.
 *      The owner cancels a pending rotation with `veto` during the window. */

/** A guardian = a friend's EOA address (lowercased for storage / comparison). */
export type GuardianAddress = string;

/** A weighted-validator config in the SHAPE the SDK's createWeightedECDSAValidator
 *  / getUpdateConfigCall expect: `signers` are `{ address, weight }`, `threshold`
 *  is the required total weight, `delay` is the timelock in seconds. */
export interface WeightedConfig {
  threshold: number;
  signers: Array<{ address: GuardianAddress; weight: number }>;
  /** On-chain timelock (seconds) before an approved rotation can finalize. */
  delay: number;
}

/** Default recovery timelock: 48h. Long enough that the owner gets the XMTP
 *  push and can `veto` with their passkey/owner key before a malicious quorum
 *  finalizes; short enough to stay usable for a genuine lost-device recovery. */
export const DEFAULT_RECOVERY_DELAY_SECONDS = 48 * 60 * 60;

/** "Need M of these N friends" -> the weighted config the validator wants.
 *  Weight-1-per-guardian + integer threshold = M (review item 3: no rounding
 *  griefing edge). Validates the M-of-N invariant up front. */
export function weightedConfigFor(
  guardians: GuardianAddress[],
  threshold: number,
  delay: number = DEFAULT_RECOVERY_DELAY_SECONDS,
): WeightedConfig {
  const signers = dedupeGuardians(guardians);
  if (signers.length === 0) throw new Error('At least one guardian is required.');
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > signers.length) {
    throw new Error(`Threshold must be an integer between 1 and ${signers.length}.`);
  }
  if (!Number.isInteger(delay) || delay < 0) {
    throw new Error('Delay must be a non-negative integer (seconds).');
  }
  return {
    threshold,
    signers: signers.map(address => ({ address, weight: 1 })),
    delay,
  };
}

/** Lowercase, de-duplicate, drop blanks — guardians are addresses, order is not
 *  significant to the math (the validator sorts by address on-chain). */
export function dedupeGuardians(guardians: GuardianAddress[]): GuardianAddress[] {
  const seen = new Set<string>();
  const out: GuardianAddress[] = [];
  for (const g of guardians) {
    const a = (g ?? '').trim().toLowerCase();
    if (!a || seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
}

/** A recovery REQUEST — what the owner-being-recovered broadcasts to guardians
 *  over XMTP. Carries the wallet (Kernel) address being recovered + the NEW owner
 *  address the guardians are asked to approve. No secrets; guardians sign the
 *  on-chain rotation themselves (offchain signature collection, §(d)). */
export interface RecoveryRequest {
  kind: 'recovery.request';
  /** Counterfactual Kernel address (the wallet) being recovered. */
  wallet: string;
  /** The new owner (EOA) address that should become `sudo` after rotation. */
  newOwner: string;
  /** Optional human label for the wallet, display only. */
  label?: string;
}

/** A guardian APPROVAL — posted back into the recovery conversation. Carries the
 *  guardian's EIP-712 `Approve` signature over the rotation's callDataAndNonceHash
 *  (the validator's offchain-collected signature, §(d)); the initiator concatenates
 *  these into the one sponsored doRecovery userOp. */
export interface RecoveryApproval {
  kind: 'recovery.approval';
  wallet: string;
  newOwner: string;
  /** The guardian address that signed. */
  guardian: string;
  /** The guardian's EIP-712 Approve signature (0x-hex). */
  signature: string;
}

export type RecoveryMessage = RecoveryRequest | RecoveryApproval;

const REQUEST_PREFIX = '​[stage:recovery]';

/** Encode a recovery control message as a single XMTP text line. A zero-width
 *  prefix + JSON keeps it on the existing text rail (reuse §3, no new codec) yet
 *  unambiguous to parse and invisible-ish in a raw client. */
export function encodeRecoveryMessage(msg: RecoveryMessage): string {
  return `${REQUEST_PREFIX}${JSON.stringify(msg)}`;
}

/** Parse a recovery control message from an XMTP text line, or null if the line
 *  is ordinary chat. Defensive: never throws on malformed input. */
export function parseRecoveryMessage(text: string): RecoveryMessage | null {
  if (!text || !text.startsWith(REQUEST_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(REQUEST_PREFIX.length));
    if (obj?.kind === 'recovery.request' && obj.wallet && obj.newOwner) {
      return obj as RecoveryRequest;
    }
    if (obj?.kind === 'recovery.approval' && obj.wallet && obj.newOwner && obj.signature) {
      return obj as RecoveryApproval;
    }
    return null;
  } catch {
    return null;
  }
}

/** A pending rotation, persisted owner-side so the cancel surface can show it and
 *  the finalize step knows what to wait for. The validator enforces the window
 *  on-chain; this record is the UI/bookkeeping mirror. */
export interface PendingRotation {
  wallet: string;
  newOwner: string;
  /** Unix seconds when the rotation was approved on-chain (delay starts here). */
  approvedAt: number;
  /** Unix seconds the rotation can finalize (approvedAt + delay). */
  finalizeAfter: number;
}

/** True once the timelock window has elapsed and the rotation may finalize. */
export function rotationReady(p: PendingRotation, nowSeconds: number): boolean {
  return nowSeconds >= p.finalizeAfter;
}
