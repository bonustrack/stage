/** CallCodec - the RN @xmtp/react-native-sdk JS content codec for the Metro P2P
 *  call signaling content type `metro.box/call:1.0`.
 *
 *  Pure JS (no native module): the body is `JSON.stringify(signal)` encoded as
 *  UTF-8 bytes inside an EncodedContent, so registering it in XMTP_CODECS needs
 *  NO dev-client rebuild. (The native dep, react-native-webrtc, is for the MEDIA
 *  layer only - the signaling itself is just custom XMTP messages.)
 *
 *  Mirrors PollCodec / SignatureRequestCodec exactly. `fallback` carries a terse
 *  plain-text rendering so non-Metro clients show a readable string. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type CallSignal, CALL_CONTENT_TYPE, callFallbackText,
} from './call.types';

export class CallCodec implements JSContentCodec<CallSignal> {
  contentType: ContentTypeId = CALL_CONTENT_TYPE as unknown as ContentTypeId;

  encode(content: CallSignal): EncodedContent {
    return {
      type: this.contentType,
      parameters: {},
      fallback: callFallbackText(content),
      content: new TextEncoder().encode(JSON.stringify(content)),
    } as unknown as EncodedContent;
  }

  decode(encoded: EncodedContent): CallSignal {
    return JSON.parse(new TextDecoder().decode(encoded.content as Uint8Array)) as CallSignal;
  }

  fallback(content: CallSignal): string | undefined {
    return callFallbackText(content);
  }

  /** Only the invite is worth a push (an incoming-call ring). The rest of the
   *  handshake (offer/answer/ice/accept/hangup) is silent control traffic. */
  shouldPush(content: CallSignal): boolean {
    return content?.kind === 'invite';
  }
}

/** Shared CallCodec instance - registered in XMTP_CODECS (decode/encode) and
 *  reused by xmtpSendCallSignal to route through the JS-codec send path. */
export const CALL_CODEC = new CallCodec();
