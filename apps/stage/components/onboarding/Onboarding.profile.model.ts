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
