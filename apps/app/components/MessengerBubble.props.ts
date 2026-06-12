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
  /** Close the anchored menu — retained on the contract for callers that drive the
   *  overlay (e.g. ConversationFeed clears its menu state). The bubble itself no
   *  longer opens-then-closes: single-tap waits for the double-tap-👍 to fail. */
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
  /** Poll tally, per question: questionIndex -> (optionIndex -> set of voter
   *  URIs). Drives the per-option count + result bar. Undefined for non-polls. */
  votes?: Map<number, Map<number, Set<string>>>;
  /** Option indices the local user currently has selected, per question index. */
  ownVotes?: Map<number, Set<number>>;
  /** Cast/retract a vote on a given question's option. */
  onVote?: (questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  /** Free-text answers for OPEN questions, per question: questionIndex ->
   *  (voterUri -> {text, ts}). Drives the submitted-answers list. */
  openAnswers?: Map<number, Map<string, { text: string; ts: string }>>;
  /** Submit (or, with empty text, retract) the local user's free-text answer to
   *  an open question. */
  onOpenAnswer?: (questionIndex: number, text: string) => void;
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
  /** Whether the conversation's XMTP consent is `allowed`. `false` (an unknown /
   *  stranger DM) DISABLES the Sign/Pay actions on request cards so a single tap
   *  can't sign/pay for an unaccepted sender; `undefined` leaves them enabled
   *  (allowed convs / not gated). */
  consentAllowed?: boolean;
  /** When true, the body text renders in a selectable <Text> so the OS
   *  text-selection handles appear for partial copy. Set by the "Select"
   *  action in the long-press menu (parent tracks a selected message id). */
  selectable?: boolean;
  /** Search mode only: a query whose case-insensitive occurrences in the body
   *  text are wrapped in a fluo-yellow highlight. Undefined/empty in the normal
   *  feed (no highlighting). */
  highlight?: string;
}
