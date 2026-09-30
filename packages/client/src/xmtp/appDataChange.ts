import { assignedAddresses } from './labels';
import { mentionToken } from './mentions';

function parseObject(raw: string | undefined): Record<string, unknown> | null {
  if (raw === undefined) return null;
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

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
    githubClause(stringOf(before?.github), stringOf(after?.github)),
    ...assigneeClauses(before, after),
  ].filter(Boolean);
  return clauses.length ? clauses.join(' • ') : 'updated the channel settings';
}
