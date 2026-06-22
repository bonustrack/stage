
import {
  type PollContent, pollFallbackText,
} from '@stage-labs/client/xmtp/poll';
import {
  POLL_CONTENT_TYPE, encodeJsonContent, decodeJsonContent,
  type XmtpContentTypeId, type EncodedJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class PollCodec {
  contentType: XmtpContentTypeId = POLL_CONTENT_TYPE;

  encode(content: PollContent): EncodedJsonContent {
    return encodeJsonContent(this.contentType, content, pollFallbackText(content));
  }

  decode(encoded: { content: Uint8Array }): PollContent {
    return decodeJsonContent<PollContent>(encoded.content);
  }

  fallback(content: PollContent): string | undefined {
    return pollFallbackText(content);
  }

  shouldPush(): boolean {
    return true;
  }
}

export const POLL_CODEC = new PollCodec();
