import { claimStatusText, type ClaimState } from './settings/ProfileSettings.claim.model';

export type UsernameStatus =
  | { kind: 'checking' }
  | { kind: 'ok'; tip: string }
  | { kind: 'error'; tip: string }
  | null;

export const USERNAME_COPY = { title: 'Pick a username', about: 'Pick a username so people can find you on Stage.' } as const;

export const USERNAME_TIPS = { available: 'Available', taken: 'Already taken', trailingHyphen: 'Cannot end with a hyphen' } as const;

const HINTED_PHASES = new Set<ClaimState['phase']>(['failed', 'claimed']);

function invalidTip(state: ClaimState, label: string): string {
  if (label.endsWith('-')) return USERNAME_TIPS.trailingHyphen;
  return state.detail ?? 'That name is not allowed';
}

export function usernameReady(state: ClaimState, label: string): boolean {
  return label !== '' && state.phase === 'available';
}

export function usernameStatus(state: ClaimState, label: string): UsernameStatus {
  if (label === '') return null;
  if (state.phase === 'checking') return { kind: 'checking' };
  if (state.phase === 'available') return { kind: 'ok', tip: USERNAME_TIPS.available };
  if (state.phase === 'unavailable') return { kind: 'error', tip: USERNAME_TIPS.taken };
  if (state.phase === 'invalid') return { kind: 'error', tip: invalidTip(state, label) };
  return null;
}

export function usernameHint(state: ClaimState, label: string): string | undefined {
  return label !== '' && HINTED_PHASES.has(state.phase) ? claimStatusText(state) : undefined;
}
