/** PollCodec — the RN @xmtp/react-native-sdk JS content codec for the Metro
 *  poll content type `metro.box/poll:1.0`.
 *
 *  Pure JS (no native module): the poll body is just `JSON.stringify(poll)`
 *  encoded as UTF-8 bytes inside an `EncodedContent`, so registering it in
 *  `XMTP_CODECS` needs NO dev-client rebuild. `fallback` carries the plain-text
 *  rendering so vanilla XMTP clients (and any client missing this codec) show a
 *  readable "📊 Poll: …" string instead of a blank/error bubble.
 *
 *  Votes are NOT handled here — a vote is an `xmtp.org/reaction:2.0` whose
 *  `reference` is the poll message id and whose `content` is the option index
 *  (`schema:'custom'`). See xmtp.ts `xmtpVote`. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import { type PollContent, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import {
  POLL_CONTENT_TYPE, encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class PollCodec implements JSContentCodec<PollContent> {
  contentType: ContentTypeId = POLL_CONTENT_TYPE;

  encode(content: PollContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, pollFallbackText(content)) as EncodedContent;
  }

  decode(encoded: EncodedContent): PollContent {
    return decodeJsonContent<PollContent>(encoded.content);
  }

  fallback(content: PollContent): string | undefined {
    return pollFallbackText(content);
  }

  /** Polls are worth a push — surface them like a normal inbound message. */
  shouldPush(): boolean {
    return true;
  }
}
