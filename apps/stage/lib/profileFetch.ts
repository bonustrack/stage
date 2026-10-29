export async function profileRequest<T>(
  input: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('The profile request timed out. Try again to check its status.'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    const request = fetch(input, { ...init, signal: controller.signal }).then(read);
    return await Promise.race([request, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function readPicture(uri: string): Promise<Blob> {
  return profileRequest(uri, {}, async (response) => {
    if (!response.ok) throw new Error('The selected picture could not be read. Choose it again.');
    return response.blob();
  });
}
