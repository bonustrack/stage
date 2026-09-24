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

export function visibleSuggestions(word: string, wordlist: readonly string[] = english, limit = SUGGESTION_LIMIT): string[] {
  return suggestWords(word, wordlist, limit + 1).filter((candidate) => candidate !== word).slice(0, limit);
}

export function applyCompletion(text: string, word: string): string {
  const trimmed = text.replace(/\S+$/, '');
  return `${trimmed}${word} `;
}

export function hasWordWithPrefix(prefix: string, wordlist: readonly string[] = english): boolean {
  return wordlist.some((word) => word.startsWith(prefix));
}

function acceptTypedSpace(previous: string, wordlist: readonly string[]): boolean {
  if (previous.trim().length === 0) return false;
  if (!looksLikePhrase(previous)) return true;
  const token = currentToken(previous);
  return !token.complete && wordlist.includes(token.word);
}

function acceptTypedLetter(previous: string, next: string, wordlist: readonly string[]): string {
  const token = currentToken(next);
  if (token.word.length === 0 || hasWordWithPrefix(token.word, wordlist)) return next;
  const finished = currentToken(previous);
  const char = next.slice(-1).toLowerCase();
  const startsNextWord = !finished.complete && wordlist.includes(finished.word) && hasWordWithPrefix(char, wordlist);
  return startsNextWord ? `${previous} ${char}` : previous;
}

export function acceptTypedChar(previous: string, next: string, wordlist: readonly string[] = english): string {
  if (next.length !== previous.length + 1 || !next.startsWith(previous)) return next;
  if (/\s$/.test(next)) return acceptTypedSpace(previous, wordlist) ? next : previous;
  if (!looksLikePhrase(next)) return next;
  return acceptTypedLetter(previous, next, wordlist);
}

export interface PhraseTyping {
  text: string;
  pending: string;
}

function uniqueWord(prefix: string, wordlist: readonly string[]): string | null {
  const matches = suggestWords(prefix, wordlist, 2);
  return matches.length === 1 ? matches[0] ?? null : null;
}

function absorbsPending(state: PhraseTyping, next: string): boolean {
  if (state.pending === '' || next.length !== state.text.length + 1 || !next.startsWith(state.text)) return false;
  return next.slice(-1).toLowerCase() === state.pending[0];
}

export function normalizePastedPhrase(pasted: string): string {
  const trimmed = pasted.trim();
  if (!/^[A-Za-z\s_-]+$/.test(trimmed)) return trimmed;
  return trimmed.replace(/[\s_-]+/g, ' ').toLowerCase();
}

function isSingleTypedChar(previous: string, next: string): boolean {
  return next.length === previous.length + 1 && next.startsWith(previous);
}

export function typePhrase(state: PhraseTyping, next: string, wordlist: readonly string[] = english): PhraseTyping {
  if (absorbsPending(state, next)) return { text: state.text, pending: state.pending.slice(1) };
  if (!isSingleTypedChar(state.text, next) && next.length > state.text.length) {
    return { text: normalizePastedPhrase(next), pending: '' };
  }
  const text = acceptTypedChar(state.text, next, wordlist);
  const typedLetter = next.length === state.text.length + 1 && text !== state.text && !/\s$/.test(text);
  if (!typedLetter || !looksLikePhrase(text)) return { text, pending: '' };
  const token = currentToken(text);
  const word = uniqueWord(token.word, wordlist);
  if (word === null) return { text, pending: '' };
  return { text: applyCompletion(text, word), pending: word.slice(token.word.length) };
}

export function invalidWords(text: string, wordlist: readonly string[] = english): string[] {
  const set = new Set(wordlist);
  const token = currentToken(text);
  const words = text.trim().toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  const finished = token.complete ? words : words.slice(0, -1);
  return finished.filter((word) => !set.has(word));
}

export function looksLikePhrase(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && !t.startsWith('0x') && !t.includes(':');
}
