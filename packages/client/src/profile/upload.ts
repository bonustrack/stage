
export const PINEAPPLE_UPLOAD_URL = 'https://pineapple.fyi/upload';

export function parsePineappleResponse(json: unknown): string {
  const parsed = (json ?? {}) as { result?: { cid?: string }; error?: { message?: string } };
  if (parsed.error?.message) throw new Error(parsed.error.message);
  const cid = parsed.result?.cid;
  if (!cid) throw new Error('Pineapple returned no CID');
  return `ipfs://${cid}`;
}
