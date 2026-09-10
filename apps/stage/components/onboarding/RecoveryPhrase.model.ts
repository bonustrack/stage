import { english } from 'viem/accounts';

export const SUGGESTION_LIMIT = 6;

export interface PhraseToken {
  word: string;
  complete: boolean;
}

export function currentToken(text: string): PhraseToken {
  const complete = /\s$/.test(text) || text.length === 0;
  const parts = text.trim().split(/\s+/).filter((part) => part.length > 0);
  const last = parts[parts.length - 1];
  return { word: complete || last === undefined ? '' : last.toLowerCase(), complete };
}

export function suggestWords(prefix: string, wordlist: readonly string[] = english, limit = SUGGESTION_LIMIT): string[] {
  const clean = prefix.toLowerCase();
  if (clean.length === 0) return [];
  const matches: string[] = [];
  for (const word of wordlist) {
    if (word.startsWith(clean)) {
      matches.push(word);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

export function uniqueCompletion(prefix: string, wordlist: readonly string[] = english): string | null {
  const clean = prefix.toLowerCase();
  if (clean.length === 0) return null;
  let found: string | null = null;
  for (const word of wordlist) {
    if (!word.startsWith(clean)) continue;
    if (found !== null) return null;
    found = word;
  }
  return found;
}

export function applyCompletion(text: string, word: string): string {
  const trimmed = text.replace(/\S+$/, '');
  return `${trimmed}${word} `;
}

export function completeIfUnique(previous: string, next: string, wordlist: readonly string[] = english): string {
  if (next.length <= previous.length) return next;
  const token = currentToken(next);
  if (token.complete || token.word.length === 0) return next;
  const word = uniqueCompletion(token.word, wordlist);
  return word === null ? next : applyCompletion(next, word);
}

export function invalidWords(text: string, wordlist: readonly string[] = english): string[] {
  const set = new Set(wordlist);
  const token = currentToken(text);
  const words = text.trim().toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  const finished = token.complete ? words : words.slice(0, -1);
  return finished.filter((word) => !set.has(word));
}
