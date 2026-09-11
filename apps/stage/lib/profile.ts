import { Platform } from 'react-native';
import { PINEAPPLE_UPLOAD_URL, parsePineappleResponse } from '@stage-labs/client/profile/upload';

async function filePart(uri: string, mime: string, name: string): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS !== 'web') return { uri, name, type: mime };
  const blob = await (await fetch(uri)).blob();
  return new File([blob], name, { type: mime || blob.type });
}

export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('file', (await filePart(uri, mime, name)) as Blob);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
  return parsePineappleResponse(json);
}
