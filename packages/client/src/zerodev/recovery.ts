
export type GuardianAddress = string;

export interface WeightedConfig {
  threshold: number;
  signers: { address: GuardianAddress; weight: number }[];
  delay: number;
}

export const DEFAULT_RECOVERY_DELAY_SECONDS = 48 * 60 * 60;

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

export interface RecoveryRequest {
  kind: 'recovery.request';
  wallet: string;
  newOwner: string;
  label?: string;
}

export interface RecoveryApproval {
  kind: 'recovery.approval';
  wallet: string;
  newOwner: string;
  guardian: string;
  signature: string;
}

export type RecoveryMessage = RecoveryRequest | RecoveryApproval;

const REQUEST_PREFIX = '​[stage:recovery]';

export function encodeRecoveryMessage(msg: RecoveryMessage): string {
  return `${REQUEST_PREFIX}${JSON.stringify(msg)}`;
}
