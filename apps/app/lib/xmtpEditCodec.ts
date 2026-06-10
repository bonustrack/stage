/** EditCodec + UnsendCodec — the RN @xmtp/react-native-sdk JS content codecs for
 *  the Metro message-edit / message-unsend content types `metro.box/edit:1.0`
 *  and `metro.box/unsend:1.0`.
 *
 *  Pure JS (no native module): both bodies are just `JSON.stringify(content)`
 *  encoded as UTF-8 bytes inside an `EncodedContent`, so registering them in
 *  `XMTP_CODECS` needs NO dev-client rebuild (mirrors PollCodec / WalletSendCallsCodec).
 *  `fallback` carries the plain-text rendering so vanilla XMTP clients (and any
 *  client missing this codec) show a readable string instead of a blank bubble. */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import {
  type EditContent, type UnsendContent,
  editFallbackText, unsendFallbackText,
} from '@stage-labs/client/xmtp/edit';
import {
  EDIT_CONTENT_TYPE, UNSEND_CONTENT_TYPE,
  encodeJsonContent, decodeJsonContent,
} from '@stage-labs/client/xmtp/codecs';

export class EditCodec implements JSContentCodec<EditContent> {
  contentType: ContentTypeId = EDIT_CONTENT_TYPE;

  encode(content: EditContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, editFallbackText(content)) as EncodedContent;
  }

  decode(encoded: EncodedContent): EditContent {
    return decodeJsonContent<EditContent>(encoded.content);
  }

  fallback(content: EditContent): string | undefined {
    return editFallbackText(content);
  }

  /** An edit replaces an existing bubble in place — no new push (the original
   *  already notified, and a re-push for a typo fix would be noise). */
  shouldPush(): boolean {
    return false;
  }
}

export class UnsendCodec implements JSContentCodec<UnsendContent> {
  contentType: ContentTypeId = UNSEND_CONTENT_TYPE;

  encode(content: UnsendContent): EncodedContent {
    return encodeJsonContent(this.contentType, content, unsendFallbackText(content)) as EncodedContent;
  }

  decode(encoded: EncodedContent): UnsendContent {
    return decodeJsonContent<UnsendContent>(encoded.content);
  }

  fallback(content: UnsendContent): string | undefined {
    return unsendFallbackText(content);
  }

  /** A deletion is not push-worthy. */
  shouldPush(): boolean {
    return false;
  }
}
