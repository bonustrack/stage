import { outgoingFileMeta } from '../../lib/attachmentFiles';
import type { LocalAttachmentInput } from '../../modules/messaging';
import type { Attachment } from './types';

export interface SendStep {
  localId: string;
  text: string;
  attachments: Attachment[];
  run: () => Promise<string>;
}

interface ComposerSenders {
  text: (line: string, text: string) => Promise<string>;
  reply: (line: string, replyTo: string, text: string) => Promise<string>;
  attachments: (line: string, files: LocalAttachmentInput[]) => Promise<string>;
}

export function planSendSteps(
  xmtpLine: string,
  body: string,
  attachments: Attachment[],
  replyTo: string | undefined,
  senders: ComposerSenders,
  mintLocalId: () => string,
): SendStep[] {
  const steps: SendStep[] = [];
  if (body) {
    steps.push({
      localId: mintLocalId(), text: body, attachments: [],
      run: () => replyTo ? senders.reply(xmtpLine, replyTo, body) : senders.text(xmtpLine, body),
    });
  }
  if (attachments.length > 0) {
    steps.push({
      localId: mintLocalId(), text: '', attachments,
      run: () => senders.attachments(
        xmtpLine,
        attachments.map((at) => ({ fileUri: at.url, ...outgoingFileMeta(at) })),
      ),
    });
  }
  return steps;
}
