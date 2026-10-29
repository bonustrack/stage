import { outgoingFileMeta } from '../../lib/attachmentFiles';
import type { LocalAttachmentInput, OnAttachmentsUploaded } from '../../lib/xmtp.types';
import { isLocation, locationText } from './location.model';
import type { Attachment } from './types';
import { textAttachment } from './textAttachment.model';

export function fileInputs(attachments: readonly Attachment[]): LocalAttachmentInput[] {
  return attachments.filter((at) => !isLocation(at)).map((at) => ({ fileUri: at.url, ...outgoingFileMeta(at) }));
}

export interface SendStep {
  localId: string;
  text: string;
  attachments: Attachment[];
  location?: Attachment;
  sourceText?: boolean;
  run: (onUploaded?: OnAttachmentsUploaded) => Promise<string>;
}

interface ComposerSenders {
  text: (line: string, text: string, beforeSend?: () => Promise<void>) => Promise<string>;
  reply: (line: string, replyTo: string, text: string, beforeSend?: () => Promise<void>) => Promise<string>;
  attachments: (
    line: string,
    files: LocalAttachmentInput[],
    onUploaded?: OnAttachmentsUploaded,
    beforeSend?: () => Promise<void>,
    replyTo?: string,
  ) => Promise<string>;
}

function fileStep(
  line: string,
  files: Attachment[],
  senders: ComposerSenders,
  localId: string,
  assertCurrent?: () => void,
  beforeSend?: () => Promise<void>,
  replyTo?: string,
): SendStep {
  return {
    localId,
    text: '',
    attachments: files,
    run: (onUploaded) => {
      assertCurrent?.();
      const validate =
        beforeSend === undefined
          ? undefined
          : async (): Promise<void> => {
              await beforeSend();
              assertCurrent?.();
            };
      if (replyTo !== undefined) return senders.attachments(line, fileInputs(files), onUploaded, validate, replyTo);
      return validate === undefined
        ? senders.attachments(line, fileInputs(files), onUploaded)
        : senders.attachments(line, fileInputs(files), onUploaded, validate);
    },
  };
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
      const validate = async (): Promise<void> => {
        await beforeSend();
        assertCurrent?.();
      };
      return replying ? senders.reply(xmtpLine, replying, text, validate) : senders.text(xmtpLine, text, validate);
    };
  };
  const textFile = textAttachment(body, mintLocalId);
  if (textFile !== null) {
    steps.push({ ...fileStep(xmtpLine, [textFile], senders, textFile.id, assertCurrent, beforeSend, replyTo), sourceText: true });
  } else if (body.trim()) {
    const text = body.trim();
    steps.push({ localId: mintLocalId(), text, attachments: [], run: sendText(text) });
  }
  const files = attachments.filter((at) => !isLocation(at));
  if (files.length > 0) steps.push(fileStep(xmtpLine, files, senders, mintLocalId(), assertCurrent, beforeSend));
  for (const location of attachments.filter(isLocation)) {
    const text = locationText(location);
    steps.push({ localId: mintLocalId(), text, attachments: [], location, run: sendText(text) });
  }
  return steps;
}

interface DraftStep {
  text: string;
  attachments: { id: string }[];
  location?: { id: string };
  sourceText?: boolean;
}

export function unsentDraft<A extends { id: string }>(text: string, pending: A[], unsent: DraftStep[]): { text: string; pending: A[] } {
  const ids = new Set(unsent.flatMap((s) => [...s.attachments, ...(s.location ? [s.location] : [])].map((at) => at.id)));
  return {
    text: unsent.some((s) => s.sourceText === true || (s.text !== '' && !s.location)) ? text : '',
    pending: pending.filter((at) => ids.has(at.id)),
  };
}
