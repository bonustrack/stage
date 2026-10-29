export const STAGE_NAMES_PARENT = 'stage.base.eth';
export const STAGE_NAME_MIN_LENGTH = 6;
export const STAGE_NAME_MAX_LENGTH = 32;
const CLAIM_TTL_MS = 10 * 60 * 1000;

const LABEL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type LabelProblem = 'too-short' | 'too-long' | 'characters';

export function validateStageLabel(label: string): LabelProblem | null {
  if (label.length < STAGE_NAME_MIN_LENGTH) return 'too-short';
  if (label.length > STAGE_NAME_MAX_LENGTH) return 'too-long';
  if (!LABEL_PATTERN.test(label)) return 'characters';
  return null;
}

export function describeLabelProblem(problem: LabelProblem): string {
  switch (problem) {
    case 'too-short':
      return `At least ${STAGE_NAME_MIN_LENGTH} characters.`;
    case 'too-long':
      return `At most ${STAGE_NAME_MAX_LENGTH} characters.`;
    case 'characters':
      return 'Only a-z, 0-9 and single inner hyphens.';
  }
}

export function stageNameOf(label: string): string {
  return `${label}.${STAGE_NAMES_PARENT}`;
}

export function isStageName(name: string): boolean {
  return name.toLowerCase().endsWith(`.${STAGE_NAMES_PARENT}`);
}

export function displayHandle(name: string): string {
  return isStageName(name) ? `@${name.slice(0, -(STAGE_NAMES_PARENT.length + 1)).toLowerCase()}` : name;
}

export interface ClaimRequest {
  label: string;
  address: string;
  issuedAt: number;
  mailKey?: string;
}

export function claimMessage(claim: ClaimRequest): string {
  const message = `Claim ${stageNameOf(claim.label)} for ${claim.address.toLowerCase()} at ${claim.issuedAt}`;
  return claim.mailKey === undefined ? message : `${message} with st.box mail key ${claim.mailKey.toLowerCase()}`;
}

export function claimIsFresh(issuedAt: number, now: number): boolean {
  return Number.isFinite(issuedAt) && now - issuedAt >= -60_000 && now - issuedAt <= CLAIM_TTL_MS;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

async function namesGet(proxyBase: string, path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${proxyBase}/names/${path}`);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown> | null;
}

export async function fetchIssuedName(proxyBase: string, address: string): Promise<string | null> {
  return nonEmptyString((await namesGet(proxyBase, `status?address=${encodeURIComponent(address)}`))?.name);
}

export async function fetchIssuedAddress(proxyBase: string, label: string): Promise<string | null> {
  return nonEmptyString((await namesGet(proxyBase, `resolve?label=${encodeURIComponent(label)}`))?.address);
}

export interface UsernameWords {
  adjective: string;
  noun: string;
  digits: string;
}

const ADJECTIVES = [
  'brave',
  'calm',
  'bright',
  'swift',
  'quiet',
  'bold',
  'clever',
  'gentle',
  'happy',
  'lucky',
  'mellow',
  'nimble',
  'proud',
  'rapid',
  'shiny',
  'silent',
  'sunny',
  'witty',
  'zesty',
  'cosmic',
  'golden',
  'silver',
  'crimson',
  'amber',
  'misty',
  'rustic',
  'frosty',
  'breezy',
  'cozy',
  'daring',
  'eager',
  'fancy',
  'fuzzy',
  'jolly',
  'keen',
  'lively',
  'merry',
  'noble',
  'plucky',
  'spry',
];

const NOUNS = [
  'otter',
  'falcon',
  'maple',
  'river',
  'comet',
  'panda',
  'tiger',
  'harbor',
  'meadow',
  'pebble',
  'badger',
  'cedar',
  'dolphin',
  'ember',
  'fox',
  'glacier',
  'heron',
  'island',
  'jaguar',
  'koala',
  'lantern',
  'magpie',
  'nebula',
  'orchid',
  'parrot',
  'quartz',
  'raven',
  'sparrow',
  'thunder',
  'walrus',
  'willow',
  'yak',
  'zebra',
  'canyon',
  'breeze',
  'lynx',
  'moose',
  'puffin',
  'summit',
  'violet',
];

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function usernameFromWords(words: UsernameWords): string {
  const digits = clean(words.digits) || '0';
  let name = `${clean(words.adjective)}${clean(words.noun)}`.slice(0, STAGE_NAME_MAX_LENGTH);
  while (name.length < STAGE_NAME_MIN_LENGTH) name += digits;
  return name.slice(0, STAGE_NAME_MAX_LENGTH);
}

function randomIndex(size: number): number {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value % size;
}

export function randomUsername(): string {
  return usernameFromWords({
    adjective: ADJECTIVES[randomIndex(ADJECTIVES.length)] ?? 'brave',
    noun: NOUNS[randomIndex(NOUNS.length)] ?? 'otter',
    digits: String(10 + randomIndex(90)),
  });
}
