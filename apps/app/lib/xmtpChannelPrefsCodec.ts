/** ChannelPrefsCodec — the RN @xmtp/react-native-sdk JS content codec for the
 *  Stage channel-preferences sync content type `stage.app/channel-prefs:1.0`.
 *
 *  Pure JS (no native module): the body is `JSON.stringify(content)` as UTF-8
 *  bytes inside an `EncodedContent`, so registering it in `XMTP_CODECS` needs no
 *  dev-client rebuild (mirrors PollCodec / the tx codecs). These messages flow
 *  only over the user's own single-member self-group (see lib/channelPrefsSync.ts)
 *  and are never rendered as chat, so `fallback` is a terse marker and
 *  `shouldPush` is false (device-state sync must never raise a notification). */

import type {
  JSContentCodec, ContentTypeId, EncodedContent,
} from '@xmtp/react-native-sdk';
import type { ChannelPrefsMessage } from '@stage-labs/client/xmtp/channelPrefs';
import { CHANNEL_PREFS_CONTENT_TYPE } from '@stage-labs/client/xmtp/channelPrefs';
import { encodeJsonContent, decodeJsonContent } from '@stage-labs/client/xmtp/codecs';
import { channelPrefsSchema } from '@stage-labs/client/xmtp/channelPrefs.schema';

export class ChannelPrefsCodec implements JSContentCodec<ChannelPrefsMessage> {
  contentType: ContentTypeId = CHANNEL_PREFS_CONTENT_TYPE;

  encode(content: ChannelPrefsMessage): EncodedContent {
    return encodeJsonContent(this.contentType, content, '[channel prefs]') as EncodedContent;
  }

  decode(encoded: EncodedContent): ChannelPrefsMessage {
    return decodeJsonContent<ChannelPrefsMessage>(
      encoded.content, channelPrefsSchema, 'xmtp.channelPrefs',
    );
  }

  fallback(): string | undefined {
    return '[channel prefs]';
  }

  /** Silent device-state sync — never a notification. */
  shouldPush(): boolean {
    return false;
  }
}
