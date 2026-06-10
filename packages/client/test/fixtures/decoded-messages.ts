/** Recorded sample XMTP DecodedMessage VIEWS, captured to mirror the structural
 *  subset the envelope mapper reads off the native RN SDK `DecodedMessage`.
 *  These stand in for live device payloads so the mapper is testable off-device.
 *
 *  `content` is a function (the SDK decodes lazily + may throw); each fixture
 *  closes over its decoded value, and `throwing` simulates an unavailable codec. */

import type { DecodedMessageView } from '../../src/xmtp/envelope';

const NS = 1_717_000_000_000 * 1_000_000; // a fixed sentNs (ms -> ns)

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

/** An EDIT of `msg-text-1` carrying the new body. */
export const editMessage: DecodedMessageView = {
  id: 'msg-edit-1',
  senderInboxId: 'inbox-alice',
  sentNs: NS,
  contentTypeId: 'metro.box/edit:1.0',
  content: () => ({ messageId: 'msg-text-1', text: 'hello, edited world' }),
};

/** An UNSEND of `msg-text-1`. */
export const unsendMessage: DecodedMessageView = {
  id: 'msg-unsend-1',
  senderInboxId: 'inbox-alice',
  sentNs: NS,
  contentTypeId: 'metro.box/unsend:1.0',
  content: () => ({ messageId: 'msg-text-1' }),
};

/** A message whose codec is unavailable on this client: `content()` throws.
 *  The mapper must produce a typed-payload fallback, NOT crash. */
export const throwingCodec: DecodedMessageView = {
  id: 'msg-unknown-1',
  senderInboxId: 'inbox-carol',
  sentNs: NS,
  contentTypeId: 'metro.box/somethingNew:9.9',
  content: () => { throw new Error('codec not registered'); },
  fallback: 'fallback text',
};
