export type NewChatPhase = 'idle' | 'creating' | 'sending';

export type NewChatMode = 'dm' | 'channel';

export interface FooterAction {
  label: string;
  enabled: boolean;
}

export const MODE_TABS: { value: NewChatMode; label: string }[] = [
  { value: 'dm', label: 'Direct message' },
  { value: 'channel', label: 'Channel' },
];

export function isNewChatMode(value: string): value is NewChatMode {
  return value === 'dm' || value === 'channel';
}

function recipientsKey(addresses: readonly string[]): string {
  return addresses.map(a => a.toLowerCase()).sort().join(',');
}

export function footerAction(mode: NewChatMode, count: number): FooterAction {
  const enabled = count > 0;
  if (mode === 'dm') return { label: 'Open chat', enabled };
  return { label: enabled ? `Create channel (${count})` : 'Create channel', enabled };
}

export function chatKey(mode: NewChatMode, addresses: readonly string[]): string {
  return `${mode}:${recipientsKey(addresses)}`;
}

export function phaseNote(phase: NewChatPhase): string | null {
  if (phase === 'creating') return 'Creating the chat…';
  if (phase === 'sending') return 'Sending…';
  return null;
}
