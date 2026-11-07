import type { HistoryEntry } from '../types';
import { userUriOf } from './line';
import { entryBuilderOf } from './contentTypes';
import { safe } from './entryBuilders';
import { objectOf, type XmtpMessage } from './message';

function textEntry(base: HistoryEntry, typeId: string, text: string): HistoryEntry {
  return { ...base, text, payload: { contentType: typeId } };
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
  const { contentTypeId: typeId, content, fallback } = message;
  const builder = entryBuilderOf(typeId);
  if (builder?.ignoresContent === true) return builder.build(base, typeId, content);
  if (message.undecodable === true) return textEntry(base, typeId, `[${typeId} payload]`);
  if (typeof content === 'string') return textEntry(base, typeId, content);
  const built = builder && objectOf(content) !== undefined ? safe(() => builder.build(base, typeId, content, fallback)) : undefined;
  return built ?? textEntry(base, typeId, fallback ?? `[${typeId} payload]`);
}
