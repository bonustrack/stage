import { FetchTimeoutError, fetchWithin } from '@stage-labs/client/timing';
const PROFILE_TIMEOUT_MS = 30_000;

export async function profileRequest<T>(
  input: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  timeoutMs = PROFILE_TIMEOUT_MS,
): Promise<T> {
  try {
    return await fetchWithin(input, init, { timeoutMs }, read);
  } catch (e) {
    if (e instanceof FetchTimeoutError) throw new Error('The profile request timed out. Try again to check its status.');
    throw e;
  }
}

export function readPicture(uri: string): Promise<Blob> {
  return profileRequest(uri, {}, async (response) => {
    if (!response.ok) throw new Error('The selected picture could not be read. Choose it again.');
    return response.blob();
  });
}
