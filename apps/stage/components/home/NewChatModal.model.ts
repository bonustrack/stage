export type NewChatPhase = 'idle' | 'creating' | 'sending';

export type NewChatStep = 'chat' | 'members' | 'details';

export interface FooterAction {
  label: string;
  enabled: boolean;
  next: NewChatStep | null;
  back: NewChatStep | null;
}

function recipientsKey(addresses: readonly string[]): string {
  return addresses.map(a => a.toLowerCase()).sort().join(',');
}

function openChatLabel(count: number): string {
  return count > 1 ? `Create group (${count})` : 'Open chat';
}

export function footerAction(step: NewChatStep, count: number): FooterAction {
  const enabled = count > 0;
  if (step === 'chat') return { label: openChatLabel(count), enabled, next: null, back: null };
  if (step === 'members') return { label: enabled ? `Next (${count})` : 'Next', enabled, next: 'details', back: 'chat' };
  return { label: 'Create group', enabled, next: null, back: 'members' };
}

export function stepTitle(step: NewChatStep): string {
  return step === 'chat' ? 'New chat' : 'New group';
}

export function isDirectChat(step: NewChatStep, count: number): boolean {
  return step === 'chat' && count === 1;
}

export function chatKey(step: NewChatStep, addresses: readonly string[]): string {
  return `${isDirectChat(step, addresses.length) ? 'dm' : 'group'}:${recipientsKey(addresses)}`;
}

export function phaseNote(phase: NewChatPhase): string | null {
  if (phase === 'creating') return 'Creating the chat…';
  if (phase === 'sending') return 'Sending…';
  return null;
}
