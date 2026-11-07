export type AvatarFilePart = Blob | { uri: string; name: string; type: string };

export function avatarFilePart(uri: string, mime: string, name: string): Promise<AvatarFilePart> {
  return Promise.resolve({ uri, name, type: mime });
}
