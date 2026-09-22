import { STAGE_NAME_MAX_LENGTH, STAGE_NAME_MIN_LENGTH } from '@stage-labs/client/identity/stageNames';

export interface UsernameWords { adjective: string; noun: string; digits: string }

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function usernameFromWords(words: UsernameWords): string {
  const digits = clean(words.digits) || '0';
  let name = `${clean(words.adjective)}${clean(words.noun)}`.slice(0, STAGE_NAME_MAX_LENGTH);
  while (name.length < STAGE_NAME_MIN_LENGTH) name += digits;
  return name.slice(0, STAGE_NAME_MAX_LENGTH);
}
