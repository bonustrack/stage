
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
    return encodeJsonContent(this.contentType, content, pollFallbackText(content));
  }

  decode(encoded: EncodedContent): PollContent {
    return decodeJsonContent<PollContent>(encoded.content);
  }

  fallback(content: PollContent): string | undefined {
    return pollFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}
