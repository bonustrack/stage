import type { XmtpMessage } from '../../src/xmtp/message';

const NS = 1_717_000_000_000 * 1_000_000;

export function xmtpMessage(fields: Partial<XmtpMessage> & Pick<XmtpMessage, 'contentTypeId' | 'content'>): XmtpMessage {
  return { id: 'msg-1', senderInboxId: 'inbox-alice', sentNs: NS, sentMs: NS / 1_000_000, ...fields };
}

export const textMessage = xmtpMessage({ id: 'msg-text-1', contentTypeId: 'text', content: 'hello world' });

export const reactionMessage = xmtpMessage({
  id: 'msg-react-1',
  senderInboxId: 'inbox-bob',
  contentTypeId: 'reaction',
  content: { reference: 'msg-text-1', content: '👍', removed: false, custom: false },
});

export const voteReaction = xmtpMessage({
  id: 'msg-vote-1',
  senderInboxId: 'inbox-bob',
  contentTypeId: 'reaction',
  content: { reference: 'poll-msg-1', content: '1', removed: false, custom: true },
});

export const undecodableMessage = xmtpMessage({
  id: 'msg-unknown-1',
  senderInboxId: 'inbox-carol',
  contentTypeId: 'somethingNew',
  content: undefined,
  undecodable: true,
  fallback: 'fallback text',
});
