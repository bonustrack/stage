/** Contentless push fan-out: routing metadata ONLY — never plaintext. */

import { type DecodedMessage } from '@xmtp/node-sdk';
import { parseLine } from './accounts.js';
import { fcmPushToAll } from './push.js';

/** F1 + E1: fan out a CONTENTLESS FCM push (routing metadata ONLY — no plaintext,
 *  sender, avatar, or group name) for an inbound message; the device decrypts
 *  locally. Caller filters own/echo + SILENT_TYPES + control DMs. */
export function pushInbound(
  accountId: string, env: Record<string, unknown>, msg: DecodedMessage, conv?: unknown,
): void {
  const line = typeof env.line === 'string' ? env.line : '';
  const messageId = typeof env.message_id === 'string'
    ? env.message_id : (typeof env.id === 'string' ? env.id : '');
  void (async (): Promise<void> => {
    const data: Record<string, string> = { line, messageId, account: accountId };
    // Lowercase the bare convId so the device's EXACT-string suppression
    // (`active_conv == data.convId`) matches the value the app stores from the
    // RN-sdk `Conversation.id`, regardless of any node-sdk/RN-sdk case skew.
    { const p = parseLine(line); if (p) data.convId = p.convId.toLowerCase(); }
    // `isGroup` is a non-content routing hint (group vs 1-1) — reveals no
    // plaintext, sender, or group name. The device uses it to pick a generic
    // card heading. DM peers expose peerInboxId(); groups don't.
    if (conv) {
      const isDm = typeof (conv as { peerInboxId?: unknown }).peerInboxId === 'function';
      if (!isDm) data.isGroup = 'true';
    }
    await fcmPushToAll(accountId, data, msg.senderInboxId);
  })().catch(() => undefined);
}
