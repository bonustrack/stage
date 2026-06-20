
export interface ReactionPayload {
  reference: string;
  action: 'added' | 'removed';
  content: string;
  schema: 'unicode' | 'custom';
}

export interface ReplyPayload {
  reference: string;
  content: { text: string };
}

export interface StaticAttachmentPayload {
  filename: string;
  mimeType: string;
  data: string;
}

export function buildReaction(
  messageId: string,
  emoji: string,
  action: 'added' | 'removed' = 'added',
): ReactionPayload {
  return { reference: messageId, action, content: emoji, schema: 'unicode' };
}

export function buildVote(
  pollMessageId: string,
  optionIndex: number,
  action: 'added' | 'removed' = 'added',
  questionIndex = 0,
): ReactionPayload {
  const content = questionIndex === 0 ? String(optionIndex) : `${questionIndex}:${optionIndex}`;
  return { reference: pollMessageId, action, content, schema: 'custom' };
}

export function buildOpenAnswer(
  pollMessageId: string,
  content: string,
  action: 'added' | 'removed' = 'added',
): ReactionPayload {
  return { reference: pollMessageId, action, content, schema: 'custom' };
}

export function buildReply(replyTo: string, text: string): ReplyPayload {
  return { reference: replyTo, content: { text } };
}

export function buildStaticAttachment(
  filename: string,
  mimeType: string,
  dataB64: string,
): StaticAttachmentPayload {
  return { filename, mimeType, data: dataB64 };
}
