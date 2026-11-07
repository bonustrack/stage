import type { HistoryEntry } from '@stage-labs/client/types';
import { envelopeOf } from '@stage-labs/client/xmtp/envelope';

const TS = '2026-09-30T00:00:00.000Z';
const LINE = 'stage://xmtp/c';

export const REMOTE_TEXT_FILE = {
  url: 'https://store.example/encrypted',
  filename: 'message.txt',
  contentDigest: 'digest',
  secret: 'secret',
  salt: 'salt',
  nonce: 'nonce',
  contentLength: '4097',
};

export function entry(id: string, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: TS, station: 'xmtp', line: LINE, from: 'u', to: 'c', ...fields };
}

export function messageEntry(id: string, contentTypeId: string, content: unknown, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  const sentMs = Date.parse(TS);
  const message = { id, senderInboxId: 'u', sentNs: sentMs * 1_000_000, sentMs, contentTypeId, content };
  return { ...envelopeOf(message, LINE), ...fields };
}

export function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function fetchHandler(handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch {
  return Object.assign(handler, { preconnect: (): void => undefined });
}
