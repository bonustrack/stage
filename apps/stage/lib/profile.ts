
import { PINEAPPLE_UPLOAD_URL, parsePineappleResponse } from '@stage-labs/client/profile/upload';

export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  form.append('file', { uri, name, type: mime } as unknown as Blob);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json: unknown = await res.json().catch(() => ({}));
  return parsePineappleResponse(json);
}
