/** @file Pure outbound XMTP payload builders (reaction, vote, reply, attachment) with ZERO @xmtp/react-native/expo imports; shapes structurally mirror the RN SDK content types so the app casts them at the native send boundary. */

/** Structural mirror of the RN SDK's `ReactionContent`. */
export interface ReactionPayload {
  reference: string;
  action: 'added' | 'removed';
  content: string;
  schema: 'unicode' | 'custom';
}

/** Structural mirror of the RN SDK's `ReplyContent` (text-only inner content). */
export interface ReplyPayload {
  reference: string;
  content: { text: string };
}

/** Structural mirror of the RN SDK's `StaticAttachmentContent`. `data` is the raw bytes base64-encoded (matches the RN SDK bridge convention). */
export interface StaticAttachmentPayload {
  filename: string;
  mimeType: string;
  data: string;
}

/** Build a reaction (add) / un-reaction (remove) targeting an existing message id in the same conversation. Unicode schema => a real emoji reaction. */
export function buildReaction(
  messageId: string,
  emoji: string,
  action: 'added' | 'removed' = 'added',
): ReactionPayload {
  return { reference: messageId, action, content: emoji, schema: 'unicode' };
}

/** Build a poll VOTE. A vote is just a reaction with `schema:'custom'` whose `content` is the chosen option INDEX and whose `reference` is the poll message id — so votes reuse the reaction tally + cross-device sync with zero new content type. */
export function buildVote(
  pollMessageId: string,
  optionIndex: number,
  action: 'added' | 'removed' = 'added',
  questionIndex = 0,
): ReactionPayload {
  /** Vote key: `"q:o"`, or a BARE option index for question 0 so legacy single-question clients (and the existing tally) keep decoding it. */
  const content = questionIndex === 0 ? String(optionIndex) : `${questionIndex}:${optionIndex}`;
  return { reference: pollMessageId, action, content, schema: 'custom' };
}

/** Build a FREE-TEXT (open) answer to a poll question: a custom-schema reaction on the poll bubble whose `content` carries the encoded answer text (`open:<q>:<base64>`) so it rides the same sync + tally pipeline; `action:'removed'` (or empty text) retracts it. */
export function buildOpenAnswer(
  pollMessageId: string,
  content: string,
  action: 'added' | 'removed' = 'added',
): ReactionPayload {
  return { reference: pollMessageId, action, content, schema: 'custom' };
}

/** Build a text reply referencing an earlier message id. */
export function buildReply(replyTo: string, text: string): ReplyPayload {
  return { reference: replyTo, content: { text } };
}

/** Build a static (inline) attachment payload. `dataB64` is the raw bytes base64-encoded (matches the RN SDK bridge convention). */
export function buildStaticAttachment(
  filename: string,
  mimeType: string,
  dataB64: string,
): StaticAttachmentPayload {
  return { filename, mimeType, data: dataB64 };
}
