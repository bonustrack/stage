import { flushDmOutbox } from '../../lib/dmOutbox';
import { subscribeChannelUpdates } from '../../lib/xmtp.resync';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { invalidateConvMeta } from './queries';
import { refreshGroupRow } from './groupRow';
import { startReadSync } from '../../lib/readSync';

const OUTBOX_FLUSH_INTERVAL_MS = 5 * 60 * 1000;

function refreshChannel(line: string): void {
  const convId = convIdOfLine(line);
  if (!convId) return;
  invalidateConvMeta(convId);
  refreshGroupRow(convId);
}

let started = false;
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeChannelUpdates(refreshChannel);
  startReadSync();
  void flushDmOutbox();
  setInterval(() => { void flushDmOutbox(); }, OUTBOX_FLUSH_INTERVAL_MS);
}
