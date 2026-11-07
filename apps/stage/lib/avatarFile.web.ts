import type { AvatarFilePart } from './avatarFile';
import { readPicture } from './profileFetch';

export async function avatarFilePart(uri: string, mime: string, name: string): Promise<AvatarFilePart> {
  const blob = await readPicture(uri);
  if (blob.size === 0 || !(mime || blob.type).startsWith('image/')) throw new Error('Choose a valid image for your profile picture.');
  return new File([blob], name, { type: mime || blob.type });
}
