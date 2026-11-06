import type { HistoryEntry } from '../types';
import { userUriOf } from './line';
import { entryBuilderOf } from './contentTypes';
import { safe } from './entryBuilders';
import { objectOf, type XmtpMessage } from './message';

function fallbackEntry(base: HistoryEntry, typeId: string, fallback: string | undefined): HistoryEntry {
  return { ...base, text: fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}

function contentEntryOf(base: HistoryEntry, typeId: string, decoded: unknown, fallback: string | undefined): HistoryEntry {
  if (typeof decoded === 'string') return { ...base, text: decoded, payload: { contentType: typeId } };
  const builder = entryBuilderOf(typeId);
  const built = builder && objectOf(decoded) !== undefined ? safe(() => builder.build(base, typeId, decoded, fallback)) : undefined;
  return built ?? fallbackEntry(base, typeId, fallback);
}

export function envelopeOf(message: XmtpMessage, line: string): HistoryEntry {
  const base: HistoryEntry = {
    id: message.id,
    ts: new Date(message.sentMs).toISOString(),
    station: 'xmtp',
    line,
    from: userUriOf(message.senderInboxId),
    to: line,
    messageId: message.id,
  };
  const typeId = message.contentTypeId;
  const builder = entryBuilderOf(typeId);
  if (builder?.ignoresContent === true) return builder.build(base, typeId, message.content);
  if (message.undecodable === true) return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } };
  return contentEntryOf(base, typeId, message.content, message.fallback);
}
