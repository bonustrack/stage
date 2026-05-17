/** Outbound event emission + train-envelope translation. */

import { Line } from '../lines.js';
import { noteSeen } from '../cache.js';
import { log } from '../log.js';
import { noteUserFromLine } from '../registry.js';
import {
  appendHistory, formatDisplay, mintId, userSelf, type HistoryEntry,
} from '../history.js';
import type { TrainEvent } from '../trains.js';
import type { CodexRC } from '../codex-rc.js';

export function makeEmit(codexRc: CodexRC | null): (entry: HistoryEntry) => void {
  return function emit(entry: HistoryEntry): void {
    /** `display` first so it survives Monitor's body truncation — the user must see it to echo it. */
    const enriched: HistoryEntry = { display: formatDisplay(entry), ...entry };
    const json = JSON.stringify(enriched);
    process.stdout.write(json + '\n');
    codexRc?.push(json);
    noteSeen(entry.line, entry.lineName);
    for (const l of [entry.line, entry.from, entry.to]) if (l) noteUserFromLine(l);
    appendHistory(enriched);
  };
}

/** Translate the snake_case train wire envelope to a camelCase `HistoryEntry`. */
/** Trains can omit `id`/`station`/`to`; metro fills sensible defaults. */
export function trainEventToHistoryEntry(env: TrainEvent, trainName: string): HistoryEntry | null {
  const line = env.line;
  if (typeof line !== 'string') {
    log.warn({ train: trainName }, 'train: dropped event without `line`');
    return null;
  }
  const station = env.station ?? Line.station(line) ?? trainName;
  const kind = (env.kind as HistoryEntry['kind'] | undefined) ?? 'inbound';
  const id = env.id ?? mintId();
  const ts = env.ts ?? new Date().toISOString();
  const from = env.from ?? `metro://${station}`;
  const isPrivate = env.is_private === true;
  const to = env.to ?? (isPrivate ? userSelf() : line);
  return {
    id, ts, kind, station,
    line: line as HistoryEntry['line'],
    lineName: env.line_name,
    from: from as HistoryEntry['from'],
    fromName: env.from_name,
    to: to as HistoryEntry['to'],
    text: env.text,
    emoji: env.emoji,
    messageId: env.message_id,
    replyTo: env.reply_to,
    payload: env.payload,
  };
}
