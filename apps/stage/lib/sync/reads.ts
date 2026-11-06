import { applyReadUpTo, applyUnread, type CachedChannelRow } from '@stage-labs/client/xmtp/channelsCache';
import type { ReadStateContent } from '@stage-labs/client/xmtp/sync/read';
import { getCachedRows, onReadStateChanged, raiseLastReadNs, setCachedRows, setMarkedUnreadFlag } from '../channelsCache';
import { knownActiveAccountId } from '../accountSelection';
import { rowIdOfConv } from '../xmtp.conv';
import { stampLocal, takeIfNewer } from './clock';
import { defineAppSyncKind } from './kind';

const readKey = (convId: string): string => `read:${convId}`;

function patchedRows<R extends CachedChannelRow>(rows: R[], state: ReadStateContent): R[] {
  const next = state.markedUnread ? applyUnread(rows, state.convId) : applyReadUpTo(rows, state.convId, state.lastReadNs);
  return next ?? rows;
}

async function applyReadStates(remote: readonly ReadStateContent[]): Promise<void> {
  const reads = await Promise.all(remote.map(async (state) => ({ ...state, convId: await rowIdOfConv(state.convId) })));
  const applied: ReadStateContent[] = [];
  for (const state of reads) {
    if (!takeIfNewer(readKey(state.convId), state.at)) continue;
    await raiseLastReadNs(state.convId, state.lastReadNs);
    await setMarkedUnreadFlag(state.convId, state.markedUnread);
    applied.push(state);
  }
  const rows = getCachedRows();
  if (!rows) return;
  const next = applied.reduce(patchedRows, rows);
  if (next !== rows) setCachedRows(next);
}

export const READ_KIND = defineAppSyncKind({
  kind: 'read',
  watch: (publish) => {
    onReadStateChanged((change) => {
      const key = readKey(change.convId);
      const content: ReadStateContent = { ...change, at: stampLocal(key) };
      const accountId = knownActiveAccountId();
      publish({ key, ...(accountId === null ? {} : { accountId }), content: () => Promise.resolve(content) });
    });
  },
  apply: (_accountId, replay) => applyReadStates(replay.read),
});
