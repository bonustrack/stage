import { claimStatusText, type ClaimState } from '../settings/ProfileSettings.claim.model';
import { DESCRIPTION_MAX, DISPLAY_NAME_MAX } from '../settings/ProfileSettings.edit.model';

export interface ProfileImage { uri: string; mime: string; name?: string }

export interface ProfileSetup {
  label: string;
  displayName?: string;
  description?: string;
  image?: ProfileImage;
}

export interface ProfileDetails {
  displayName: string;
  description: string;
  image: ProfileImage | null;
}

export const EMPTY_DETAILS: ProfileDetails = { displayName: '', description: '', image: null };

export function profileSetupFrom(label: string, details: ProfileDetails): ProfileSetup | null {
  if (label === '') return null;
  const name = details.displayName.trim();
  const about = details.description.trim();
  return {
    label,
    ...(name === '' ? {} : { displayName: name }),
    ...(about === '' ? {} : { description: about }),
    ...(details.image === null ? {} : { image: details.image }),
  };
}

export function profileDetailsProblem(details: ProfileDetails): string | null {
  if (details.displayName.trim().length > DISPLAY_NAME_MAX) return `Name is limited to ${DISPLAY_NAME_MAX} characters.`;
  if (/[\r\n]/.test(details.displayName)) return 'Name cannot span several lines.';
  if (details.description.trim().length > DESCRIPTION_MAX) return `About is limited to ${DESCRIPTION_MAX} characters.`;
  return null;
}

export function canContinueUsername(state: ClaimState, label: string): boolean {
  return label !== '' && state.phase === 'available';
}

export type UsernameStatus =
  | { kind: 'checking' }
  | { kind: 'ok'; tip: string }
  | { kind: 'error'; tip: string }
  | null;

export const USERNAME_TIPS = { available: 'Available', taken: 'Already taken', trailingHyphen: 'Cannot end with a hyphen' } as const;

function invalidTip(state: ClaimState, label: string): string {
  if (label.endsWith('-')) return USERNAME_TIPS.trailingHyphen;
  return state.detail ?? 'That name is not allowed';
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
  return label !== '' && state.phase === 'failed' ? claimStatusText(state) : undefined;
}
