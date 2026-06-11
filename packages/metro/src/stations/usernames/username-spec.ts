// Stage username spec — DAEMON-SIDE COPY.
//
// Byte-identical logic to @stage-labs/client/identity/username, duplicated here
// ON PURPOSE: metro trains run from ~/.metro/trains via symlink + NODE_PATH and
// CANNOT resolve the `@stage-labs/client` workspace package at runtime (the xmtp
// station inlines its shared SDK bits for the same reason — see
// stations/xmtp/codecs.ts). Keep this in sync with the SDK module; both are pure
// TS with no deps, guarded by a parity test in the client package.

export const STAGE_PARENT = 'stage.box';
export const NAME_MIN = 3;
export const NAME_MAX = 32;

const LABEL_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED = new Set<string>([
  'stage', 'admin', 'root', 'www', 'mail', 'ftp', 'api', 'app', 'gateway',
  'usernames', 'username', 'resolver', 'ens', 'box', 'metro', 'support',
  'help', 'about', 'team', 'staff', 'official', 'system', 'null', 'undefined',
  'anonymous', 'me', 'you', 'wallet', 'settings', 'register', 'claim',
]);

export type NameError = 'length' | 'charset' | 'reserved';

export function normalizeName(input: string): string {
  let n = input.trim().toLowerCase();
  if (n.endsWith(`.${STAGE_PARENT}`)) n = n.slice(0, -`.${STAGE_PARENT}`.length);
  else if (n.endsWith('.box')) n = n.slice(0, -'.box'.length);
  return n;
}

export function validateName(name: string): NameError | null {
  if (name.length < NAME_MIN || name.length > NAME_MAX) return 'length';
  if (!LABEL_RE.test(name)) return 'charset';
  if (RESERVED.has(name)) return 'reserved';
  return null;
}

export function nameErrorMessage(e: NameError): string {
  switch (e) {
    case 'length': return `Must be ${NAME_MIN}-${NAME_MAX} characters.`;
    case 'charset': return 'Lowercase letters, numbers and single hyphens only.';
    case 'reserved': return 'That name is reserved.';
  }
}

export function fullName(name: string): string {
  return `${name}.${STAGE_PARENT}`;
}

export function claimMessage(name: string, address: string, ts: number): string {
  return [
    'Stage username claim',
    `name: ${fullName(name)}`,
    `address: ${address.toLowerCase()}`,
    `ts: ${ts}`,
  ].join('\n');
}

export interface UsernameRecord {
  name: string;
  address: string;
  avatar?: string;
  sig: string;
  ts: number;
}
