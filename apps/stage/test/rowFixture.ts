import { NO_TAGS } from '@stage-labs/client/xmtp/channelMeta';
import type { Row } from '../components/home/model';

export function row(convId: string, fields: Partial<Row> = {}): Row {
  return {
    ...NO_TAGS,
    convId,
    title: convId,
    lastTs: 1,
    lastBubbleTs: 1,
    lastPreview: '',
    avatarAddress: null,
    avatarUri: null,
    peerAddress: null,
    lastSenderAddress: null,
    lastFromSelf: false,
    inboxToAddr: {},
    unreadCount: 0,
    lastReadNs: 0,
    markedUnread: false,
    selfInboxId: 'self',
    consent: 'allowed',
    ...fields,
  };
}
