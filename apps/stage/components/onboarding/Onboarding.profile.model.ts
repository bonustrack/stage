import type { ProfileImage, ProfileSetup } from '@stage-labs/client/profile/setup';
export type { ProfileImage, ProfileSetup } from '@stage-labs/client/profile/setup';

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
    ...(details.image === null
      ? {}
      : {
          image: {
            uri: details.image.uri,
            mime: details.image.mime,
            ...(details.image.name === undefined ? {} : { name: details.image.name }),
          },
        }),
  };
}
