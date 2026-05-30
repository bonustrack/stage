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

import { Buffer } from 'buffer';
import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import { type PollContent, pollFallbackText } from '@metro-labs/client/xmtp/poll';

export class PollCodec implements JSContentCodec<PollContent> {
  contentType: ContentTypeId = {
    authorityId: 'metro.box',
    typeId: 'poll',
    versionMajor: 1,
    versionMinor: 0,
  };

  encode(content: PollContent): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: pollFallbackText(content),
      content: new Uint8Array(Buffer.from(JSON.stringify(content), 'utf8')),
    };
  }

  decode(encoded: EncodedContent): PollContent {
    const json = Buffer.from(encoded.content).toString('utf8');
    return JSON.parse(json) as PollContent;
  }

  fallback(content: PollContent): string | undefined {
    return pollFallbackText(content);
  }

  /** Polls are worth a push — surface them like a normal inbound message. */
  shouldPush(): boolean {
    return true;
  }
}
