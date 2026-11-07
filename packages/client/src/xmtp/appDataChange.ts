import { parseObject } from './labels';
import { describeChannelMetaChange } from './channelMeta';

function onlyDescriptionChanged(before: Record<string, unknown> | null, after: Record<string, unknown> | null): boolean {
  if (!before || !after) return false;
  if (![before.description, after.description].every((value) => value === undefined || typeof value === 'string')) return false;
  if ((before.description ?? '') === (after.description ?? '')) return false;
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields].every(
    (field) =>
      field === 'description' ||
      (Object.hasOwn(before, field) === Object.hasOwn(after, field) && JSON.stringify(before[field]) === JSON.stringify(after[field])),
  );
}

export function describeAppDataChange(oldValue: string | undefined, newValue: string | undefined): string {
  const before = parseObject(oldValue);
  const after = parseObject(newValue);
  if (onlyDescriptionChanged(before, after)) return 'updated the channel description';
  const clauses = describeChannelMetaChange(before, after);
  return clauses.length ? clauses.join(' • ') : 'updated the channel settings';
}
