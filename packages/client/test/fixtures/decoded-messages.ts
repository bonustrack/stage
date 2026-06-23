
import type { DecodedMessageView } from '../../src/xmtp/envelope';

const NS = 1_717_000_000_000 * 1_000_000;

export const textMessage: DecodedMessageView = {
  id: 'msg-text-1',
  senderInboxId: 'inbox-alice',
  sentNs: NS,
  contentTypeId: 'xmtp.org/text:1.0',
  content: () => 'hello world',
};

export const reactionMessage: DecodedMessageView = {
  id: 'msg-react-1',
  senderInboxId: 'inbox-bob',
  sentNs: NS,
  contentTypeId: 'xmtp.org/reaction:2.0',
  content: () => ({ reference: 'msg-text-1', action: 'added', content: '👍', schema: 'unicode' }),
};

export const voteReaction: DecodedMessageView = {
  id: 'msg-vote-1',
  senderInboxId: 'inbox-bob',
  sentNs: NS,
  contentTypeId: 'xmtp.org/reaction:2.0',
  content: () => ({ reference: 'poll-msg-1', action: 'added', content: '1', schema: 'custom' }),
};

export const throwingCodec: DecodedMessageView = {
  id: 'msg-unknown-1',
  senderInboxId: 'inbox-carol',
  sentNs: NS,
  contentTypeId: 'metro.box/somethingNew:9.9',
  content: () => { throw new Error('codec not registered'); },
  fallback: 'fallback text',
};
