import { assignedAddresses, channelFieldOf, parseObject, stringList, type ChannelField } from './labels';
import { mentionToken } from './mentions';

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function quotedList(items: string[]): string {
  return items.map(item => `"${item}"`).join(', ');
}

function labelClauses(before: string[], after: string[]): string[] {
  const has = (list: string[], label: string): boolean => list.some(l => l.toLowerCase() === label.toLowerCase());
  const added = after.filter(l => !has(before, l));
  const removed = before.filter(l => !has(after, l));
  return [
    added.length ? `added label${added.length === 1 ? '' : 's'} ${quotedList(added)}` : '',
    removed.length ? `removed label${removed.length === 1 ? '' : 's'} ${quotedList(removed)}` : '',
  ].filter(Boolean);
}

function fieldClause(field: ChannelField, oldValue: unknown, newValue: unknown): string {
  const before = channelFieldOf(field, oldValue);
  const after = channelFieldOf(field, newValue);
  if (after === null) return before === null ? '' : `removed ${field} "${before}"`;
  if (before === after) return '';
  return before === null ? `set ${field} "${after}"` : `changed ${field} to "${after}"`;
}

function githubClause(before: string, after: string): string {
  if (before === after) return '';
  if (!after) return 'unlinked the GitHub link';
  return `linked ${after.replace(/^https?:\/\/(www\.)?/, '')}`;
}

function assigneesOf(blob: Record<string, unknown> | null): string[] | null {
  if (!blob) return null;
  return blob.assigned === undefined || Array.isArray(blob.assigned) ? assignedAddresses(blob.assigned) : null;
}

function assigneeClauses(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const previous = assigneesOf(before);
  const next = assigneesOf(after);
  if (!previous || !next) return [];
  const added = next.filter(address => !previous.includes(address));
  const removed = previous.filter(address => !next.includes(address));
  return [
    added.length ? `assigned ${added.map(mentionToken).join(', ')}` : '',
    removed.length ? `unassigned ${removed.map(mentionToken).join(', ')}` : '',
  ].filter(Boolean);
}

export function describeAppDataChange(oldValue: string | undefined, newValue: string | undefined): string {
  const before = parseObject(oldValue);
  const after = parseObject(newValue);
  const clauses = [
    ...labelClauses(stringList(before?.labels), stringList(after?.labels)),
    ...(['category', 'status', 'priority'] as const).map(field => fieldClause(field, before?.[field], after?.[field])),
    githubClause(stringOf(before?.github), stringOf(after?.github)),
    ...assigneeClauses(before, after),
  ].filter(Boolean);
  return clauses.length ? clauses.join(' • ') : 'updated the channel settings';
}
