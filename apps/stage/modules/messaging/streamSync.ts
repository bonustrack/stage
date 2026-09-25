
import { flushDmOutbox } from '../../lib/dmOutbox';
import { subscribeAllMessages } from '../../lib/xmtp.stream';
import type { StreamMsg } from '../../lib/xmtp.types';
import { invalidateConvMeta } from './queries';
import { refreshGroupRow } from './groupRow';
import { startReadSync } from '../../lib/readSync';

const GROUP_UPDATED = 'group_updated';
const OUTBOX_FLUSH_INTERVAL_MS = 5 * 60 * 1000;

function isGroupUpdated(m: StreamMsg): boolean {
  const id = m.msg.contentTypeId;
  return typeof id === 'string' && id.includes(GROUP_UPDATED);
}

let started = false;
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeAllMessages((m: StreamMsg) => {
    if (!m.convId || !isGroupUpdated(m)) return;
    invalidateConvMeta(m.convId);
    refreshGroupRow(m.convId);
  });
  startReadSync();
  void flushDmOutbox();
  setInterval(() => { void flushDmOutbox(); }, OUTBOX_FLUSH_INTERVAL_MS);
}
