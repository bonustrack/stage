export const STAGE_NAMES_PARENT = 'stage.base.eth';
export const STAGE_NAME_MIN_LENGTH = 6;
export const STAGE_NAME_MAX_LENGTH = 32;
export const CLAIM_TTL_MS = 10 * 60 * 1000;

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type LabelProblem = 'too-short' | 'too-long' | 'characters';

export function validateStageLabel(label: string): LabelProblem | null {
  if (label.length < STAGE_NAME_MIN_LENGTH) return 'too-short';
  if (label.length > STAGE_NAME_MAX_LENGTH) return 'too-long';
  if (!LABEL_PATTERN.test(label)) return 'characters';
  return null;
}

export function describeLabelProblem(problem: LabelProblem): string {
  switch (problem) {
    case 'too-short': return `At least ${STAGE_NAME_MIN_LENGTH} characters.`;
    case 'too-long': return `At most ${STAGE_NAME_MAX_LENGTH} characters.`;
    case 'characters': return 'Lowercase letters, digits and hyphens only, no hyphen at the start or end.';
  }
}

export function stageNameOf(label: string): string {
  return `${label}.${STAGE_NAMES_PARENT}`;
}

export function isStageName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${STAGE_NAMES_PARENT}`);
}

export interface ClaimRequest {
  label: string;
  address: string;
  issuedAt: number;
}

export function claimMessage(claim: ClaimRequest): string {
  return `Claim ${stageNameOf(claim.label)} for ${claim.address.toLowerCase()} at ${claim.issuedAt}`;
}

export function claimIsFresh(issuedAt: number, now: number): boolean {
  return Number.isFinite(issuedAt) && now - issuedAt >= -60_000 && now - issuedAt <= CLAIM_TTL_MS;
}
