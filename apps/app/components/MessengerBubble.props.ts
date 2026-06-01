/** Prop contract for the MessengerBubble row. Extracted to keep the component
 *  file under the phase-2 lint cap. */

import type { HistoryEntry } from '../lib/types';

export interface MessengerBubbleProps {
  entry: HistoryEntry; dark: boolean; unread: boolean; pending?: boolean; replyTarget?: boolean;
  onReact?: (emoji: string) => void; onReply?: () => void; onLongPress?: () => void;
  /** Single-tap a message → open the Telegram-style anchored menu. The parent
   *  positions the emoji-strip + action-dropdown overlay relative to the row's
   *  on-screen rect (measured here via measureInWindow). */
  onOpenMenu?: (anchor: { y: number; height: number }) => void;
  /** Close the just-opened anchored menu — fired when a fast double-tap supersedes
   *  the instant single-tap menu open (the double-tap is treated as a quick 👍). */
  onCloseMenu?: () => void;
  /** Tap the quoted reply-preview slab → parent jumps/scrolls to the original
   *  message. No-op when undefined (e.g. a bubble that isn't a reply). */
  onReplyPreviewPress?: () => void;
  /** Tapping a question option fires this with the chosen label (parent sends it as
   *  a normal user message with replyTo=entry.id so the agent links the answer to
   *  the question). */
  onAnswer?: (label: string) => void;
  replyPreview?: string; reactions?: Map<string, number>;
  /** Optimistic (not-yet-confirmed) reactions from the local user — rendered at
   *  reduced opacity alongside confirmed reaction pills until the live XMTP
   *  stream echoes them back. */
  pendingReactions?: string[];
  /** Emojis the local user just un-reacted (optimistic) — hide the confirmed pill
   *  immediately until the live stream echoes the `removed` event. */
  pendingRemovals?: string[];
  /** Emojis the local user currently owns on this message — own pills get a subtle
   *  outline + tapping/long-pressing one toggles the reaction off (onReact). */
  ownEmojis?: Set<string>;
  transcript?: string;
  /** Self URI used to mark a bubble as the user's own. XMTP callers pass
   *  `metro://xmtp/user/<inboxId>`. */
  myUri: string;
  /** Resolved eth address of the sender — used for the left-side stamp.fyi
   *  avatar. null when the SDK hasn't surfaced the mapping yet (we fall back
   *  to a tinted placeholder so row geometry doesn't shift). */
  senderEthAddress?: string | null;
  /** Tap on the avatar — parent routes to the per-user profile view. Skipped
   *  when undefined (e.g. legacy callers that don't wire it). */
  onAvatarPress?: (address: string) => void;
  /** Poll tally: option index → set of voter URIs. Drives the per-option count
   *  + result bar. Undefined for non-poll bubbles. */
  votes?: Map<number, Set<string>>;
  /** Option indices the local user currently has selected on this poll. */
  ownVotes?: Set<number>;
  /** Cast/retract a vote on this poll's option. */
  onVote?: (optionIndex: number, action: 'added' | 'removed') => void;
  /** Pay an in-chat payment request (WalletSendCalls). The parent broadcasts the
   *  call via the phase-3 sendTx helper and posts a TransactionReference back.
   *  Undefined => the Pay button is hidden (e.g. it's the user's own request). */
  onPay?: () => void;
  /** True while this request's payment is broadcasting — shows a spinner on Pay. */
  paying?: boolean;
  /** Sign an in-chat signature request. The parent signs via wagmi
   *  (signTypedData / signMessage) and posts a SignatureReference back. */
  onSign?: () => void;
  /** True while this request's signature is being produced — shows a spinner. */
  signing?: boolean;
}
