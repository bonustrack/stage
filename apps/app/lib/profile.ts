/** @file Group-avatar image upload helper that pins a local image to the pineapple IPFS gateway and returns an `ipfs://<cid>` URI. */

/*
 * Image upload helper for group avatars. Uploads a local image to pineapple
 *  (Snapshot's IPFS pinning gateway) and returns an `ipfs://<cid>` URI suitable
 *  to store as a group's image. This is the only profile-related write left in
 *  the app: user identity (name/avatar) is READ-ONLY from stamp.fyi / ENS and
 *  has no in-app editing. No Snapshot hub usage.
 */

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
