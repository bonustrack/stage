import { STAGE_NAME_MAX_LENGTH, STAGE_NAME_MIN_LENGTH } from '@stage-labs/client/identity/stageNames';

export interface UsernameWords { adjective: string; noun: string; digits: string }

const ADJECTIVES = [
  'brave', 'calm', 'bright', 'swift', 'quiet', 'bold', 'clever', 'gentle', 'happy', 'lucky',
  'mellow', 'nimble', 'proud', 'rapid', 'shiny', 'silent', 'sunny', 'witty', 'zesty', 'cosmic',
  'golden', 'silver', 'crimson', 'amber', 'misty', 'rustic', 'frosty', 'breezy', 'cozy', 'daring',
  'eager', 'fancy', 'fuzzy', 'jolly', 'keen', 'lively', 'merry', 'noble', 'plucky', 'spry',
];

const NOUNS = [
  'otter', 'falcon', 'maple', 'river', 'comet', 'panda', 'tiger', 'harbor', 'meadow', 'pebble',
  'badger', 'cedar', 'dolphin', 'ember', 'fox', 'glacier', 'heron', 'island', 'jaguar', 'koala',
  'lantern', 'magpie', 'nebula', 'orchid', 'parrot', 'quartz', 'raven', 'sparrow', 'thunder', 'walrus',
  'willow', 'yak', 'zebra', 'canyon', 'breeze', 'lynx', 'moose', 'puffin', 'summit', 'violet',
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
