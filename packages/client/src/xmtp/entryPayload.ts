import type { GroupUpdatedContent } from './humanize';
import { objectOf } from './message';

interface PayloadHolder {
  payload?: unknown;
}

function fieldOf(entry: PayloadHolder | undefined, key: string): unknown {
  return objectOf(entry?.payload)?.[key];
}

export function payloadTypeOf(entry: PayloadHolder | undefined): string | undefined {
  const type = fieldOf(entry, 'contentType');
  return typeof type === 'string' ? type : undefined;
}

export function reactionTargetOf(entry: PayloadHolder | undefined): string | undefined {
  const target = fieldOf(entry, 'reactTo');
  return typeof target === 'string' && target !== '' ? target : undefined;
}

export function isSystemEntry(entry: PayloadHolder | undefined): boolean {
  return fieldOf(entry, 'system') === true;
}

export function groupUpdateOf(entry: PayloadHolder | undefined): GroupUpdatedContent | null {
  const update = objectOf(fieldOf(entry, 'groupUpdate'));
  return isSystemEntry(entry) && update !== undefined ? update : null;
}
