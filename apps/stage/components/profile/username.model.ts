import { describeLabelProblem, stageLabelOf, validateStageLabel } from '@stage-labs/client/identity/stageNames';

type ClaimPhase = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'claiming' | 'claimed' | 'failed';

export interface ClaimState {
  label: string;
  phase: ClaimPhase;
  detail?: string;
}

type UsernameStatus = { kind: 'checking' } | { kind: 'ok'; tip: string } | { kind: 'error'; tip: string } | null;

export const USERNAME_COPY = { title: 'Pick a username', about: 'Pick a username so people can find you on Stage.' } as const;

const USERNAME_STATUS_COPY = {
  available: 'Available',
  taken: 'Already taken',
  trailingHyphen: 'Cannot end with a hyphen',
  notAllowed: 'That name is not allowed',
  claimed: (handle: string) => `${handle} is yours. It can take a minute to show everywhere.`,
  failed: (detail: string | undefined) => `Could not claim the name: ${detail ?? 'unknown error'}`,
} as const;

export function sanitizeLabelInput(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-/, '');
}

export function normalizeLabel(raw: string): string {
  const typed = raw.trim().toLowerCase();
  return stageLabelOf(typed) ?? typed;
}

export function localLabelProblem(label: string): string | null {
  if (label === '') return null;
  const problem = validateStageLabel(label);
  return problem ? describeLabelProblem(problem) : null;
}

export function claimStatusTone(state: ClaimState): 'success' | 'danger' | 'secondary' {
  if (state.phase === 'available' || state.phase === 'claimed') return 'success';
  if (state.phase === 'unavailable' || state.phase === 'invalid' || state.phase === 'failed') return 'danger';
  return 'secondary';
}

function invalidTip(state: ClaimState, label: string): string {
  if (label.endsWith('-')) return USERNAME_STATUS_COPY.trailingHyphen;
  return state.detail ?? USERNAME_STATUS_COPY.notAllowed;
}

export function usernameReady(state: ClaimState, label: string): boolean {
  return label !== '' && state.phase === 'available';
}

export function usernameStatus(state: ClaimState, label: string): UsernameStatus {
  if (label === '') return null;
  if (state.phase === 'checking') return { kind: 'checking' };
  if (state.phase === 'available') return { kind: 'ok', tip: USERNAME_STATUS_COPY.available };
  if (state.phase === 'unavailable') return { kind: 'error', tip: USERNAME_STATUS_COPY.taken };
  if (state.phase === 'invalid') return { kind: 'error', tip: invalidTip(state, label) };
  return null;
}

export function usernameHint(state: ClaimState, label: string): string | undefined {
  if (label === '') return undefined;
  if (state.phase === 'claimed') return USERNAME_STATUS_COPY.claimed(`@${state.label}`);
  if (state.phase === 'failed') return USERNAME_STATUS_COPY.failed(state.detail);
  return undefined;
}
