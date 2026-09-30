import type { HistoryEntry } from '@stage-labs/client/types';
import { DELETED_MESSAGE_TEXT } from '@stage-labs/client/xmtp/deleteMessage';
import { deletedEntryView, isDeletableEntry } from '@stage-labs/client/xmtp/deletions';
import { previewOf } from './feed-helpers';

export const DELETE_MESSAGE_CONFIRM = {
  title: 'Delete message?',
  message: 'It will be removed for everyone in Stage. Other apps may still show it.',
  confirmLabel: 'Delete',
  destructive: true,
};

export function canDeleteMessage(entry: HistoryEntry | null, myUri: string, deletedIds: ReadonlySet<string>): boolean {
  return entry !== null && entry.from === myUri && !entry.id.startsWith('tmp_')
    && isDeletableEntry(entry) && !deletedIds.has(entry.id);
}

export function replyQuoteOf(
  item: HistoryEntry, deletedIds: ReadonlySet<string>, lookup: (id: string) => HistoryEntry | undefined,
): string | undefined {
  const target = item.replyTo;
  if (!target) return undefined;
  if (deletedIds.has(target)) return DELETED_MESSAGE_TEXT;
  return previewOf(lookup(target) ?? item);
}

export function deletedViewCache(): (item: HistoryEntry) => HistoryEntry {
  const cache = new WeakMap<HistoryEntry, HistoryEntry>();
  return (item) => {
    const hit = cache.get(item);
    if (hit) return hit;
    const view = deletedEntryView(item);
    cache.set(item, view);
    return view;
  };
}
