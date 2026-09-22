import { stageNameOf } from '@stage-labs/client/identity/stageNames';
import type { ProfileSetup } from '../components/onboarding/Onboarding.profile.model';
import { claimStageName, setPrimaryStageName } from './claimName';
import { saveBasenameProfile } from './profileWrite';

export async function applyProfileSetup(address: string, profile: ProfileSetup): Promise<void> {
  await claimStageName(profile.label);
  await setPrimaryStageName(address, profile.label);
  if (profile.displayName === undefined && profile.description === undefined && profile.image === undefined) return;
  await saveBasenameProfile(address, stageNameOf(profile.label), {
    displayName: profile.displayName, description: profile.description, image: profile.image,
  });
}
