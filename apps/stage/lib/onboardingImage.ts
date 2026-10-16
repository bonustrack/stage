import { File } from 'expo-file-system';
import type { ProfileSetup } from '@stage-labs/client/profile/setup';

export async function preserveProfileImage(profile: ProfileSetup): Promise<ProfileSetup> {
  if (profile.image === undefined || profile.image.uri.startsWith('data:image/')) return profile;
  const data = await new File(profile.image.uri).base64();
  if (data === '') throw new Error('The selected picture could not be read. Choose it again.');
  return { ...profile, image: { ...profile.image, uri: `data:${profile.image.mime};base64,${data}` } };
}
