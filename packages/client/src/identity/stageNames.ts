export const STAGE_NAMES_PARENT = 'stage.base.eth';
export const STAGE_NAME_MIN_LENGTH = 6;
export const STAGE_NAME_MAX_LENGTH = 32;
const CLAIM_TTL_MS = 10 * 60 * 1000;

const LABEL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
    case 'characters': return 'Only a-z, 0-9 and single inner hyphens.';
  }
}

export function stageNameOf(label: string): string {
  return `${label}.${STAGE_NAMES_PARENT}`;
}

export function isStageName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${STAGE_NAMES_PARENT}`);
}

export function displayHandle(name: string): string {
  return isStageName(name) ? `@${name.slice(0, -(STAGE_NAMES_PARENT.length + 1)).toLowerCase()}` : name;
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

const NAMES_CLIENT_HEADERS = { 'x-stage-client': '1' };

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

async function namesGet(proxyBase: string, path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${proxyBase}/names/${path}`, { headers: NAMES_CLIENT_HEADERS });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown> | null;
}

export async function fetchIssuedName(proxyBase: string, address: string): Promise<string | null> {
  return nonEmptyString((await namesGet(proxyBase, `status?address=${encodeURIComponent(address)}`))?.name);
}

export async function fetchIssuedAddress(proxyBase: string, label: string): Promise<string | null> {
  return nonEmptyString((await namesGet(proxyBase, `resolve?label=${encodeURIComponent(label)}`))?.address);
}
