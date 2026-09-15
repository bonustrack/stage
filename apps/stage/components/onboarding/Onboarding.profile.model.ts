import type { ClaimState } from '../settings/ProfileSettings.claim.model';
import { DISPLAY_NAME_MAX } from '../settings/ProfileSettings.edit.model';

export interface ProfileImage { uri: string; mime: string; name?: string }

export interface ProfileSetup {
  label: string;
  displayName?: string;
  image?: ProfileImage;
}

export function profileSetupFrom(label: string, displayName: string, image: ProfileImage | null): ProfileSetup | null {
  if (label === '') return null;
  const name = displayName.trim();
  return { label, ...(name === '' ? {} : { displayName: name }), ...(image === null ? {} : { image }) };
}

export function profileStepProblem(label: string, displayName: string, hasImage: boolean): string | null {
  if (displayName.trim().length > DISPLAY_NAME_MAX) return `Name is limited to ${DISPLAY_NAME_MAX} characters.`;
  if (/[\r\n]/.test(displayName)) return 'Name cannot span several lines.';
  if (label === '' && (displayName.trim() !== '' || hasImage)) return 'Pick a username to save your name and picture.';
  return null;
}

export function canContinueProfile(state: ClaimState, label: string, displayName: string, hasImage: boolean): boolean {
  if (profileStepProblem(label, displayName, hasImage) !== null) return false;
  return label === '' || state.phase === 'available';
}
