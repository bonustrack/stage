/** @file PollCodec, the pure-JS @xmtp/react-native-sdk content codec for `metro.box/poll:1.0` (JSON body + plain-text fallback so it registers without a dev-client rebuild); votes are reactions handled elsewhere. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import { type PollContent, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import {
  POLL_CONTENT_TYPE, encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class PollCodec implements JSContentCodec<PollContent> {
  contentType: ContentTypeId = POLL_CONTENT_TYPE;

  /** Encode a poll as JSON-bytes content with its plain-text fallback. */
  encode(content: PollContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, pollFallbackText(content));
  }

  /** Decode the JSON wire body back into a poll. */
  decode(encoded: EncodedContent): PollContent {
    return decodeJsonContent<PollContent>(encoded.content);
  }

  /** Plain-text rendering shown by clients missing this codec. */
  fallback(content: PollContent): string | undefined {
    return pollFallbackText(content);
  }

  /** Polls are worth a push — surface them like a normal inbound message. */
  shouldPush(): boolean {
    return true;
  }
}
