import { nativeFileName } from '@stage-labs/client/files';

export const OPEN_FILE_CHANNEL = 'stage:open-file';
export const MAX_OPEN_BYTES = 100_000_000;
export const TEMP_PREFIX = 'stage-open-';

const OPEN_IN_APP = new Set(['pdf', 'txt', 'log', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'mp3', 'm4a', 'wav', 'mp4', 'mov']);

export function savedFileName(name: string): string {
  return nativeFileName(name, undefined);
}

export function opensInApp(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && OPEN_IN_APP.has(name.slice(dot + 1).toLowerCase());
}
