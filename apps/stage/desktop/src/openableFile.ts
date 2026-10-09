export const OPEN_FILE_CHANNEL = 'stage:open-file';
export const MAX_OPEN_BYTES = 100_000_000;

const OPEN_IN_APP = new Set([
  'pdf', 'txt', 'csv', 'md', 'json', 'log', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'mp3', 'm4a', 'wav', 'mp4', 'mov',
]);
const RESERVED = '/\\:*?"<>|';
const MAX_NAME_LENGTH = 120;

export function savedFileName(name: string): string {
  const kept = Array.from(name, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || RESERVED.includes(c) ? '_' : c)).join('');
  const trimmed = kept.replace(/^[.\s]+/, '').trim().slice(-MAX_NAME_LENGTH);
  return trimmed === '' ? 'attachment' : trimmed;
}

export function opensInApp(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && OPEN_IN_APP.has(name.slice(dot + 1).toLowerCase());
}
