import { outgoingFileMeta } from '../../lib/attachmentFiles';
import type { LocalAttachmentInput, OnAttachmentsUploaded } from '../../lib/xmtp.types';
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
  run: (onUploaded?: OnAttachmentsUploaded) => Promise<string>;
}

interface ComposerSenders {
  text: (line: string, text: string, beforeSend?: () => Promise<void>) => Promise<string>;
  reply: (line: string, replyTo: string, text: string, beforeSend?: () => Promise<void>) => Promise<string>;
  attachments: (line: string, files: LocalAttachmentInput[], onUploaded?: OnAttachmentsUploaded, beforeSend?: () => Promise<void>) => Promise<string>;
}

export function planSendSteps(
  xmtpLine: string,
  body: string,
  attachments: Attachment[],
  replyTo: string | undefined,
  senders: ComposerSenders,
  mintLocalId: () => string,
  assertCurrent?: () => void,
  beforeSend?: () => Promise<void>,
): SendStep[] {
  const steps: SendStep[] = [];
  const sendText = (text: string): (() => Promise<string>) => {
    const replying = steps.length === 0 ? replyTo : undefined;
    return async () => {
      await beforeSend?.();
      assertCurrent?.();
      if (beforeSend === undefined) return replying ? senders.reply(xmtpLine, replying, text) : senders.text(xmtpLine, text);
      const validate = async (): Promise<void> => { await beforeSend(); assertCurrent?.(); };
      return replying ? senders.reply(xmtpLine, replying, text, validate) : senders.text(xmtpLine, text, validate);
    };
  };
  if (body) {
    steps.push({ localId: mintLocalId(), text: body, attachments: [], run: sendText(body) });
  }
  const files = attachments.filter(at => !isLocation(at));
  if (files.length > 0) {
    steps.push({
      localId: mintLocalId(), text: '', attachments: files,
      run: onUploaded => {
        assertCurrent?.();
        return beforeSend === undefined ? senders.attachments(xmtpLine, fileInputs(files), onUploaded)
          : senders.attachments(xmtpLine, fileInputs(files), onUploaded, async () => { await beforeSend(); assertCurrent?.(); });
      },
    });
  }
  for (const location of attachments.filter(isLocation)) {
    const text = locationText(location);
    steps.push({ localId: mintLocalId(), text, attachments: [], location, run: sendText(text) });
  }
  return steps;
}

interface DraftStep { text: string; attachments: { id: string }[]; location?: { id: string } }

export function unsentDraft<A extends { id: string }>(
  text: string, pending: A[], unsent: DraftStep[],
): { text: string; pending: A[] } {
  const ids = new Set(unsent.flatMap(s => [...s.attachments, ...(s.location ? [s.location] : [])].map(at => at.id)));
  return {
    text: unsent.some(s => s.text !== '' && !s.location) ? text : '',
    pending: pending.filter(at => ids.has(at.id)),
  };
}
