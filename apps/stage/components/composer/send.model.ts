import { outgoingFileMeta } from '../../lib/attachmentFiles';
import type { LocalAttachmentInput } from '../../modules/messaging';
import { isLocation, locationText } from './location.model';
import type { Attachment } from './types';

export function fileInputs(attachments: readonly Attachment[]): LocalAttachmentInput[] {
  return attachments.filter(at => !isLocation(at)).map(at => ({ fileUri: at.url, ...outgoingFileMeta(at) }));
}

export interface SendStep {
  localId: string;
  text: string;
  attachments: Attachment[];
  location?: Attachment;
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
  const sendText = (text: string): (() => Promise<string>) => {
    const replying = steps.length === 0 ? replyTo : undefined;
    return () => replying ? senders.reply(xmtpLine, replying, text) : senders.text(xmtpLine, text);
  };
  if (body) {
    steps.push({ localId: mintLocalId(), text: body, attachments: [], run: sendText(body) });
  }
  const files = attachments.filter(at => !isLocation(at));
  if (files.length > 0) {
    steps.push({
      localId: mintLocalId(), text: '', attachments: files,
      run: () => senders.attachments(xmtpLine, fileInputs(files)),
    });
  }
  for (const location of attachments.filter(isLocation)) {
    const text = locationText(location);
    steps.push({ localId: mintLocalId(), text, attachments: [], location, run: sendText(text) });
  }
  return steps;
}
