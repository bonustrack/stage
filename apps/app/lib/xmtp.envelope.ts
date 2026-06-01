/** Map a decoded XMTP message → the app/daemon `HistoryEntry` envelope. Extracted
 *  from lib/xmtp.ts (phase-2 lint split); re-exported from there via xmtp.messages. */

import {
  type DecodedMessage,
  type ReactionContent, type ReplyContent, type StaticAttachmentContent,
  type MultiRemoteAttachmentContent,
} from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { humanizeGroupUpdated, type GroupUpdatedContent } from '@metro-labs/client/xmtp/humanize';
import { type PollContent, pollFallbackText } from '@metro-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  signatureRequestFallbackText, signatureReferenceFallbackText,
} from '@metro-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, type TransactionReferenceContent,
  walletSendCallsFallbackText, transactionReferenceFallbackText,
} from '@metro-labs/client/xmtp/tx';
import { XMTP_USER_PREFIX } from './xmtp.types';

/** Convert a decoded XMTP message into the same `HistoryEntry` envelope used by the
 *  daemon-side event log + the existing `MessengerBubble` renderer. Mirrors the
 *  shape emitted by `packages/metro/examples/xmtp.ts` (the node-sdk train) so the UI
 *  layer doesn't have to care which transport an event came from. */
export function envelopeOfXmtpMessage(msg: DecodedMessage, line: string): HistoryEntry {
  const from = `${XMTP_USER_PREFIX}${msg.senderInboxId}`;
  /** `sentNs` is a JS number (nanoseconds). Divide to ms — ample precision for ts strings. */
  const ts = new Date(Math.floor(msg.sentNs / 1_000_000)).toISOString();
  const base: HistoryEntry = {
    id: msg.id,
    ts,
    station: 'xmtp',
    line,
    from,
    to: line,
    messageId: msg.id,
  };
  /** typeId looks like `xmtp.org/text:1.0` — strip authority + version for the switch. */
  const typeId = msg.contentTypeId.split('/').pop()?.split(':')[0] ?? 'unknown';
  let decoded: unknown;
  try { decoded = msg.content(); }
  catch { return { ...base, text: `[${typeId} payload]`, payload: { contentType: typeId } }; }

  if (typeof decoded === 'string') {
    return { ...base, text: decoded, payload: { contentType: typeId } };
  }
  if (typeId === 'reaction') {
    const r = decoded as ReactionContent;
    const removed = r.action === 'removed';
    /** A poll VOTE is a reaction with schema:'custom' whose content is the option
     *  index. Surface `schema:'custom'` + `voteFor`/`optionIndex` so the tally
     *  helpers can pick votes out of history (the cold-load path) and so the
     *  channels-list preview doesn't render an index as an emoji. This MUST be
     *  handled inside the single reaction branch — a second `if (typeId ===
     *  'reaction')` below would be dead code, since this branch returns first. */
    if (r.schema === 'custom') {
      return {
        ...base,
        text: `[vote ${r.content}${removed ? ' (removed)' : ''}]`,
        payload: {
          contentType: typeId, reactTo: r.reference, emoji: r.content,
          schema: 'custom', voteFor: r.reference, optionIndex: Number(r.content), removed,
        },
      };
    }
    return {
      ...base,
      text: `[react ${r.content}${removed ? ' (removed)' : ''}]`,
      payload: { contentType: typeId, reactTo: r.reference, emoji: r.content, removed },
    };
  }
  if (typeId === 'poll') {
    /** Decoded PollContent rides on `payload.poll`; `text` is the plain-text
     *  fallback so non-poll-aware surfaces (search, copy) still read sensibly. */
    const poll = decoded as PollContent;
    return {
      ...base,
      text: pollFallbackText(poll),
      payload: { contentType: typeId, poll },
    };
  }
  if (typeId === 'signatureRequest') {
    /** Signature REQUEST. The decoded SignatureRequestContent rides on
     *  `payload.signatureRequest`; the bubble renders an interactive "Sign" card. */
    const sig = decoded as SignatureRequestContent;
    return {
      ...base,
      text: signatureRequestFallbackText(sig),
      payload: { contentType: typeId, signatureRequest: sig },
    };
  }
  if (typeId === 'signatureReference') {
    /** Signature RECEIPT. The decoded SignatureReferenceContent rides on
     *  `payload.signatureReference`; the bubble renders "Signed ✓" + signer. */
    const ref = decoded as SignatureReferenceContent;
    return {
      ...base,
      text: signatureReferenceFallbackText(ref),
      payload: { contentType: typeId, signatureReference: ref },
    };
  }
  if (typeId === 'walletSendCalls') {
    /** Payment REQUEST. The decoded WalletSendCalls rides on
     *  `payload.walletSendCalls`; the bubble renders an interactive "Pay" card. */
    const wsc = decoded as WalletSendCallsContent;
    return {
      ...base,
      text: walletSendCallsFallbackText(wsc),
      payload: { contentType: typeId, walletSendCalls: wsc },
    };
  }
  if (typeId === 'transactionReference') {
    /** Payment RECEIPT. The decoded TransactionReference rides on
     *  `payload.txReference`; the bubble renders amount + explorer link. */
    const ref = decoded as TransactionReferenceContent;
    return {
      ...base,
      text: transactionReferenceFallbackText(ref),
      payload: { contentType: typeId, txReference: ref },
    };
  }
  if (typeId === 'reply') {
    const r = decoded as ReplyContent;
    /** Inner reply payload is a NativeMessageContent — promote text up to the bubble level
     *  when present, otherwise emit a fallback string so the bubble has something to show. */
    const innerText = r.content?.text;
    return {
      ...base,
      text: innerText ?? `[reply]`,
      replyTo: r.reference,
      payload: { contentType: typeId, replyTo: r.reference },
    };
  }
  if (typeId === 'group_updated' || typeId === 'groupUpdated') {
    const summary = humanizeGroupUpdated(decoded as GroupUpdatedContent);
    return { ...base, text: summary, payload: { contentType: typeId, system: true } };
  }
  if (typeId === 'attachment') {
    const a = decoded as StaticAttachmentContent;
    const kind = a.mimeType?.startsWith('image/') ? 'image'
      : a.mimeType?.startsWith('audio/') ? 'audio'
        : a.mimeType?.startsWith('video/') ? 'video' : 'file';
    return {
      ...base,
      text: `[${kind}: ${a.filename}]`,
      /** `data` arrives already base64-encoded over the RN bridge — see
       *  `ios/Wrappers/MessageWrapper.swift` (`base64EncodedString`). Pass straight through. */
      payload: { contentType: typeId, attachments: [{ kind, mime: a.mimeType, name: a.filename, dataB64: a.data }] },
    };
  }
  if (typeId === 'multiRemoteStaticAttachment' || typeId === 'multiRemoteAttachment') {
    /** One message carrying N encrypted-remote attachments. The bytes live on
     *  IPFS (ciphertext); each attachment is rendered as a `remote` placeholder
     *  and lazily downloaded + decrypted by the bubble (`resolveRemoteAttachment`).
     *  We surface the per-attachment metadata under `remote` so the renderer has
     *  everything it needs without re-decoding the message. The MIME type isn't in
     *  the metadata, so infer `kind` from the filename extension. */
    const m = decoded as MultiRemoteAttachmentContent;
    const attachments = (m.attachments ?? []).map((info, i) => {
      const name = info.filename ?? `attachment-${i + 1}`;
      const ext = name.split('.').pop()?.toLowerCase() ?? '';
      const kind = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) ? 'image'
        : ['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(ext) ? 'audio'
          : ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'file';
      return { kind, name, remote: info };
    });
    const summary = attachments.length === 1
      ? `[${attachments[0]!.kind}: ${attachments[0]!.name}]`
      : `[${attachments.length} attachments]`;
    return { ...base, text: summary, payload: { contentType: typeId, attachments } };
  }
  /** Unknown / unsupported codec — render fallback if the codec provided one. */
  return { ...base, text: msg.fallback ?? `[${typeId} payload]`, payload: { contentType: typeId } };
}
