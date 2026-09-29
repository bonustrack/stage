export type NewChatPhase = 'idle' | 'creating' | 'sending';

export function recipientsKey(addresses: readonly string[]): string {
  return addresses.map(a => a.toLowerCase()).sort().join(',');
}

export function openChatLabel(count: number): string {
  return count > 1 ? `Create group (${count})` : 'Open chat';
}

export function phaseNote(phase: NewChatPhase): string | null {
  if (phase === 'creating') return 'Creating the chat…';
  if (phase === 'sending') return 'Sending…';
  return null;
}
