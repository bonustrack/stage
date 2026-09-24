function parseObject(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
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

export function describeAppDataChange(oldValue: string | undefined, newValue: string | undefined): string {
  const before = parseObject(oldValue);
  const after = parseObject(newValue);
  const clauses = [
    ...labelClauses(stringList(before.labels), stringList(after.labels)),
    githubClause(stringOf(before.github), stringOf(after.github)),
  ].filter(Boolean);
  return clauses.length ? clauses.join(' • ') : 'updated the channel settings';
}
