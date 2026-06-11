/** Shared spec for Stage offchain usernames (`<name>.stage.box`).
 *
 *  This module is the SINGLE SOURCE OF TRUTH for the username rules and the
 *  claim-signature message, imported by BOTH the gateway train (server-side
 *  validation + signature verification) and the app (client-side availability
 *  pre-check + claim signing). Keeping it here means the two sides can never
 *  drift on what a valid name is or what the user actually signs.
 *
 *  Names live DIRECTLY under stage.box (e.g. `alice.stage.box`), resolved by a
 *  single ENSIP-10 wildcard offchain resolver on `stage.box`. There is no
 *  `username.` middle label.
 *
 *  Pure TypeScript, no deps — safe to import anywhere (RN, Node, Bun, browser). */

/** The parent name every username hangs off. */
export const STAGE_PARENT = 'stage.box';

/** Min / max label length (the `<name>` part, excluding `.stage.box`). */
export const NAME_MIN = 3;
export const NAME_MAX = 32;

/** Lower-case alphanumerics + single hyphens, no leading/trailing/double hyphen.
 *  Length is checked separately so we can give a precise error. */
const LABEL_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Reserved labels that may never be claimed first-come (brand / safety / future
 *  routes). Lower-case. Kept deliberately small + obvious; extend as needed. */
export const RESERVED = new Set<string>([
  'stage', 'admin', 'root', 'www', 'mail', 'ftp', 'api', 'app', 'gateway',
  'usernames', 'username', 'resolver', 'ens', 'box', 'metro', 'support',
  'help', 'about', 'team', 'staff', 'official', 'system', 'null', 'undefined',
  'anonymous', 'me', 'you', 'wallet', 'settings', 'register', 'claim',
]);

export type NameError = 'length' | 'charset' | 'reserved';

/** Normalise a user-typed name: trim, lower-case, drop a trailing `.stage.box`
 *  or `.box` if the user pasted the full domain. Does NOT validate. */
export function normalizeName(input: string): string {
  let n = input.trim().toLowerCase();
  if (n.endsWith(`.${STAGE_PARENT}`)) n = n.slice(0, -`.${STAGE_PARENT}`.length);
  else if (n.endsWith('.box')) n = n.slice(0, -'.box'.length);
  return n;
}

/** Validate a normalised label. Returns null if valid, else the failure reason. */
export function validateName(name: string): NameError | null {
  if (name.length < NAME_MIN || name.length > NAME_MAX) return 'length';
  if (!LABEL_RE.test(name)) return 'charset';
  if (RESERVED.has(name)) return 'reserved';
  return null;
}

/** Human-readable message for a {@link NameError}. */
export function nameErrorMessage(e: NameError): string {
  switch (e) {
    case 'length': return `Must be ${NAME_MIN}-${NAME_MAX} characters.`;
    case 'charset': return 'Lowercase letters, numbers and single hyphens only.';
    case 'reserved': return 'That name is reserved.';
  }
}

/** The full ENS name for a label. */
export function fullName(name: string): string {
  return `${name}.${STAGE_PARENT}`;
}

/** The EIP-191 personal_sign message a claimant signs to prove ownership of the
 *  address they are binding to a name. Deterministic on both sides; the `ts`
 *  (unix seconds) makes each claim unique and lets the gateway reject stale
 *  signatures. The address is lower-cased so the message is canonical.
 *
 *  Keep this string STABLE — changing it invalidates every stored signature. */
export function claimMessage(name: string, address: string, ts: number): string {
  return [
    'Stage username claim',
    `name: ${fullName(name)}`,
    `address: ${address.toLowerCase()}`,
    `ts: ${ts}`,
  ].join('\n');
}

/** A stored username record (gateway JSON store + app cache). */
export interface UsernameRecord {
  /** The label, e.g. `alice` (NOT the full `.stage.box`). */
  name: string;
  /** The bound Ethereum address, lower-cased, checksummed-agnostic. */
  address: string;
  /** Optional avatar URI (ipfs:// or https://). */
  avatar?: string;
  /** EIP-191 signature over {@link claimMessage}. */
  sig: string;
  /** Unix seconds the claim was signed (matches the `ts` in the message). */
  ts: number;
}
