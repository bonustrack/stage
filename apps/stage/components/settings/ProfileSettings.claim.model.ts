import { describeLabelProblem, stageNameOf, validateStageLabel } from '@stage-labs/client/identity/stageNames';

export type ClaimPhase = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'claiming' | 'claimed' | 'failed';

export interface ClaimState {
  label: string;
  phase: ClaimPhase;
  detail?: string;
}

export function sanitizeLabelInput(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-/, '');
}

export function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.stage\.base\.eth$/, '');
}

export function localLabelProblem(label: string): string | null {
  if (label === '') return null;
  const problem = validateStageLabel(label);
  return problem ? describeLabelProblem(problem) : null;
}

const STATIC_STATUS: Partial<Record<ClaimPhase, string>> = {
  idle: 'Six characters or more, lowercase letters, digits and hyphens.',
  checking: 'Checking availability…',
  claiming: 'Registering your name and setting it as primary…',
};

const NAME_STATUS: Partial<Record<ClaimPhase, (name: string) => string>> = {
  available: () => 'Available',
  unavailable: () => 'Already taken',
  claimed: (name) => `${name} is yours. It can take a minute to show everywhere.`,
};

export function claimStatusText(state: ClaimState): string {
  const fixed = STATIC_STATUS[state.phase];
  if (fixed !== undefined) return fixed;
  const named = NAME_STATUS[state.phase];
  if (named !== undefined) return named(stageNameOf(state.label));
  if (state.phase === 'invalid') return state.detail ?? 'That name is not allowed.';
  return `Could not claim the name: ${state.detail ?? 'unknown error'}`;
}

export function claimStatusTone(state: ClaimState): 'success' | 'danger' | 'secondary' {
  if (state.phase === 'available' || state.phase === 'claimed') return 'success';
  if (state.phase === 'unavailable' || state.phase === 'invalid' || state.phase === 'failed') return 'danger';
  return 'secondary';
}

export function canClaim(state: ClaimState): boolean {
  return state.phase === 'available';
}
