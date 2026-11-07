import type { HistoryEntry } from '@stage-labs/client/types';
import { attachmentsPayload } from '@stage-labs/client/xmtp/entryPayload';
import { attachmentsPreview } from '@stage-labs/client/xmtp/humanize';
import type { OptimisticEntry } from './types';
import { randomHex } from '@stage-labs/client/ids';

const LOCAL_ID_PREFIX = 'tmp_';

let seq = 0;

export function mintLocalId(): string {
  return `${LOCAL_ID_PREFIX}${Date.now()}_${(seq++).toString(36)}_${randomHex(2)}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith(LOCAL_ID_PREFIX);
}

export function optimisticEntryOf(sent: OptimisticEntry, line: string, myUri: string, at = new Date()): HistoryEntry {
  const { localId, text, attachments, replyTo, payload } = sent;
  return {
    id: localId,
    ts: at.toISOString(),
    station: 'xmtp',
    line,
    from: myUri,
    to: line,
    text: text || undefined,
    ...(replyTo ? { replyTo } : {}),
    ...(payload ? { payload } : attachments.length ? { payload: attachmentsPayload(attachments) } : {}),
  };
}

export function optimisticRowPreview(text: string, attachments: readonly { mime?: string; name?: string }[]): string {
  return text.trim() || attachmentsPreview(attachments.map((a) => ({ mimeType: a.mime, filename: a.name })));
}
