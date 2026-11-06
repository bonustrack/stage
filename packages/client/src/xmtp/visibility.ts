import type { HistoryEntry } from '../types';
import { roleOfType, type RowRole } from './contentTypes';
import { isDeleteRequestType } from './deleteMessage';
import { groupUpdateOf, payloadTypeOf, reactionTargetOf } from './entryPayload';
import { onlyMembersLeft } from './humanize';

const CONTROL_BODY_PREFIX = 'METRO_CTRL:';

export function isControlBody(text: unknown): boolean {
  return typeof text === 'string' && text.startsWith(CONTROL_BODY_PREFIX);
}

export interface ShownMessage {
  contentTypeId: string | undefined;
  content: unknown;
}

export function isRowCandidate(m: ShownMessage, dm: boolean): boolean {
  const role = roleOfType(m.contentTypeId);
  return !isControlBody(m.content) && role !== 'hidden' && !(dm && role === 'system');
}

export function revivesRow(m: ShownMessage, dm: boolean): boolean {
  return isRowCandidate(m, dm) && roleOfType(m.contentTypeId) !== 'silent';
}

export function countsAsUnread(m: ShownMessage): boolean {
  const role = roleOfType(m.contentTypeId);
  return !isControlBody(m.content) && (role === 'bubble' || role === 'silent');
}

export function isSystemMessage(m: Pick<ShownMessage, 'contentTypeId'>): boolean {
  return roleOfType(m.contentTypeId) === 'system';
}

export function onlyHiddenMessages(messages: readonly ShownMessage[]): boolean {
  return messages.every((m) => roleOfType(m.contentTypeId) === 'hidden');
}

export type ArrivalEffect = 'drop' | 'refresh' | 'row';

export function arrivalEffect(m: ShownMessage): ArrivalEffect {
  if (isDeleteRequestType(m.contentTypeId)) return 'refresh';
  return roleOfType(m.contentTypeId) === 'hidden' || isControlBody(m.content) ? 'drop' : 'row';
}

export function entryRoleOf(entry: HistoryEntry): RowRole {
  if (reactionTargetOf(entry) !== undefined) return 'silent';
  return roleOfType(payloadTypeOf(entry));
}

export function isLeftOnlyUpdate(entry: HistoryEntry): boolean {
  const update = groupUpdateOf(entry);
  return update !== null && onlyMembersLeft(update);
}

export function isShownInFeed(entry: HistoryEntry): boolean {
  return !isControlBody(entry.text);
}

export function isFeedBubble(entry: HistoryEntry): boolean {
  const role = entryRoleOf(entry);
  return role !== 'silent' && role !== 'hidden' && !isLeftOnlyUpdate(entry);
}

export function isSearchable(entry: HistoryEntry): boolean {
  return !!entry.text && !isControlBody(entry.text) && entryRoleOf(entry) !== 'hidden';
}
