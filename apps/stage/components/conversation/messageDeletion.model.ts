import type { HistoryEntry } from '@stage-labs/client/types';
import { deletedTextOf, type DeletedBy } from '@stage-labs/client/xmtp/deleteMessage';
import {
  deletedByOf, deletedEntryView, isDeletableEntry, type DeletedMessages,
} from '@stage-labs/client/xmtp/deletions';
import type { ConfirmOptions } from '../../lib/capabilities';
import { previewOf } from './feed-helpers';
import { isFrameActionEntry } from '../frame/frame.model';

const DELETE_MESSAGE_CONFIRM: ConfirmOptions = {
  title: 'Delete message?',
  message: 'It will be removed for everyone in Stage. Other apps may still show it.',
  confirmLabel: 'Delete',
  destructive: true,
};

const ADMIN_DELETE_MESSAGE_CONFIRM: ConfirmOptions = {
  title: 'Delete this message for everyone?',
  message: 'You’re deleting it as a channel super admin.',
  confirmLabel: 'Delete',
  destructive: true,
};

interface DeleteAccess {
  myUri: string;
  deleted: DeletedMessages;
  superAdmin: boolean;
}

export function isAdminDelete(entry: HistoryEntry, myUri: string): boolean {
  return entry.from !== myUri;
}

export function canDeleteMessage(entry: HistoryEntry | null, { myUri, deleted, superAdmin }: DeleteAccess): boolean {
  if (entry === null || entry.id.startsWith('tmp_') || !isDeletableEntry(entry) || deleted.has(entry.id)) return false;
  return !isAdminDelete(entry, myUri) || superAdmin;
}

export function deleteConfirmOf(asAdmin: boolean): ConfirmOptions {
  return asAdmin ? ADMIN_DELETE_MESSAGE_CONFIRM : DELETE_MESSAGE_CONFIRM;
}

export function replyQuoteOf(
  item: HistoryEntry, deleted: DeletedMessages, lookup: (id: string) => HistoryEntry | undefined,
): string | undefined {
  const target = item.replyTo;
  if (!target) return undefined;
  const by = deleted.get(target);
  if (by) return deletedTextOf(by);
  const quoted = lookup(target);
  if (quoted) return previewOf(quoted);
  return isFrameActionEntry(item) ? 'Frame' : previewOf(item);
}

export function deletedViewCache(): (item: HistoryEntry, by: DeletedBy) => HistoryEntry {
  const cache = new WeakMap<HistoryEntry, HistoryEntry>();
  return (item, by) => {
    const hit = cache.get(item);
    if (hit && deletedByOf(hit) === by) return hit;
    const view = deletedEntryView(item, by);
    cache.set(item, view);
    return view;
  };
}
