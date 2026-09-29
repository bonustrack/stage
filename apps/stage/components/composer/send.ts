import { xmtpReply, xmtpSendMultiRemoteAttachment, xmtpSendText } from '../../modules/messaging';
import { planSendSteps as plan, type SendStep } from './send.model';
import type { Attachment } from './types';

export type { SendStep } from './send.model';

let seq = 0;
export const mintLocalId = (): string =>
  `tmp_${Date.now()}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function planSendSteps(
  xmtpLine: string,
  body: string,
  attachments: Attachment[],
  replyTo: string | undefined,
): SendStep[] {
  return plan(xmtpLine, body, attachments, replyTo, {
    text: xmtpSendText,
    reply: xmtpReply,
    attachments: xmtpSendMultiRemoteAttachment,
  }, mintLocalId);
}
