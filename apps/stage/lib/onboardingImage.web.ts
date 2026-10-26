import type { ProfileSetup } from '@stage-labs/client/profile/setup';
import { readPicture } from './profileFetch';

export async function preserveProfileImage(profile: ProfileSetup): Promise<ProfileSetup> {
  if (profile.image === undefined || profile.image.uri.startsWith('data:image/')) return profile;
  const blob = await readPicture(profile.image.uri);
  if (blob.size === 0 || !blob.type.startsWith('image/')) throw new Error('Choose a valid image for your profile picture.');
  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') resolve(reader.result); else reject(new Error('The selected picture could not be read.')); };
    reader.onerror = () => { reject(new Error('The selected picture could not be read. Choose it again.')); };
    reader.onabort = () => { reject(new Error('Reading the selected picture was cancelled.')); };
    reader.readAsDataURL(blob);
  });
  return { ...profile, image: { ...profile.image, uri } };
}
