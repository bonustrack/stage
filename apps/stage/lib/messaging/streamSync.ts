import { flushDmOutbox } from '../dmOutbox';
import { subscribeChannelUpdates } from '../feed/merge';
import { convIdOfLine } from '@stage-labs/client/xmtp/line';
import { refreshConv } from './queries';
import { startReadSync } from '../sync/readSync';
import { startPush } from '../pushRegister';

const OUTBOX_FLUSH_INTERVAL_MS = 5 * 60 * 1000;

function refreshChannel(line: string): void {
  const convId = convIdOfLine(line);
  if (convId) refreshConv(convId);
}

let started = false;
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeChannelUpdates(refreshChannel);
  startReadSync();
  startPush();
  void flushDmOutbox();
  setInterval(() => {
    void flushDmOutbox();
  }, OUTBOX_FLUSH_INTERVAL_MS);
}
