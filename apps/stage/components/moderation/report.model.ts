import type { HistoryEntry } from '@stage-labs/client/types';
import { isDeletedPlaceholder } from '@stage-labs/client/xmtp/deletions';
import { isSystemEntry } from '@stage-labs/client/xmtp/envelope';

export interface ReportedMessage {
  sender: string;
  senderName: string | null;
  convId: string;
  chatName: string | null;
  group: boolean;
  messageId: string;
  sentAt: string;
  content: string;
}

export interface ReportedPerson {
  address: string;
  name: string | null;
}

const MAX_QUOTED = 2000;

export const REPORT_COPY = {
  messageTitle: 'Report message?',
  messageBody:
    'Stage gets a copy of this message and who sent it, so a moderator can review it. Nobody else is told. Block them too to stop their messages.',
  messageBodyInChannel: 'Stage gets a copy of this message and who sent it, so a moderator can review it. Nobody else is told.',
  personTitle: 'Report this person?',
  personBody: 'Stage gets their address and username, so a moderator can review them. Nobody else is told.',
  report: 'Report',
  reportAndBlock: 'Report and block',
  sent: 'Reported. Thank you for helping keep Stage safe.',
  queued: 'Report saved. Stage sends it as soon as it is back online.',
  failed: 'The report could not be sent. Try again.',
  blockTitle: 'Block this person?',
  blockBody: 'They can no longer message you directly, and their chat leaves your list. They are not told.',
  block: 'Block',
  blocked: 'Blocked.',
  unblocked: 'Unblocked.',
  blockFailed: 'Could not change the block. Try again.',
} as const;

function quoted(content: string): string {
  const trimmed = content.trim();
  const body = trimmed.length > MAX_QUOTED ? `${trimmed.slice(0, MAX_QUOTED)}…` : trimmed;
  return (body === '' ? '(no text)' : body)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function who(id: string, name: string | null): string {
  return name !== null && name !== '' && name !== id ? `${name} (${id})` : id;
}

export function messageReportText(m: ReportedMessage): string {
  const chat = m.group ? `channel ${m.chatName ?? ''}`.trimEnd() : 'direct message';
  return [
    'Report: message',
    `From: ${who(m.sender, m.senderName)}`,
    `Chat: ${chat} (${m.convId})`,
    `Message: ${m.messageId}, sent ${m.sentAt}`,
    '',
    quoted(m.content),
  ].join('\n');
}

export function personReportText(p: ReportedPerson): string {
  return ['Report: person', `Who: ${who(p.address, p.name)}`].join('\n');
}

export function canReportMessage(entry: HistoryEntry | null, myUri: string): boolean {
  if (entry === null || entry.pending === true || entry.from === myUri) return false;
  return !isSystemEntry(entry) && !isDeletedPlaceholder(entry);
}
