/** @file Group-avatar image upload helper pinning a local image to the pineapple IPFS gateway and returning an `ipfs://<cid>` URI; the only profile write left, since user identity is read-only from stamp.fyi / ENS. */

/** Pineapple image-pinning service (IPFS upload). Returns `{result:{cid}}`. */
const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';

/** Upload an image to pineapple. Returns an `ipfs://<cid>` URI. `uri` is a local file URI from expo-image-picker; `mime` is e.g. 'image/jpeg'. */
export async function uploadAvatar(uri: string, mime: string, name = 'avatar'): Promise<string> {
  const form = new FormData();
  /** RN's FormData accepts the `{uri, name, type}` shape — fetch streams the underlying file straight from disk; no need to base64-decode first. */
  form.append('file', { uri, name, type: mime } as unknown as Blob);
  const res = await fetch(PINEAPPLE_UPLOAD_URL, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({})) as {
    result?: { cid?: string }; error?: { message?: string };
  };
  if (json.error?.message) throw new Error(json.error.message);
  const cid = json.result?.cid;
  if (!cid) throw new Error('Pineapple returned no CID');
  return `ipfs://${cid}`;
}
