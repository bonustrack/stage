
import { subscribeAllMessages } from '../../lib/xmtp';
import type { StreamMsg } from '../../lib/xmtp.types';
import { invalidateConvMeta } from './queries';

const GROUP_UPDATED = 'group_updated';

function isGroupUpdated(m: StreamMsg): boolean {
  const id = (m.msg as unknown as { contentTypeId?: string }).contentTypeId;
  return typeof id === 'string' && id.includes(GROUP_UPDATED);
}

let started = false;
export function ensureMessagingStreamSync(): void {
  if (started) return;
  started = true;
  subscribeAllMessages((m: StreamMsg) => {
    if (m.convId && isGroupUpdated(m)) invalidateConvMeta(m.convId);
  });
}
