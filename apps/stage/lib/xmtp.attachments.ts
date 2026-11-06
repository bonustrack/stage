import type { LocalAttachmentInput, OnAttachmentsUploaded } from './xmtp.types';
import { encryptFile, sendFileReply, sendFiles, storeEncrypted } from './xmtp.attachmentSdk';
import { makeAttachmentPrep } from './xmtp.attachmentPrep.core';
import { sendPreparedAttachment, withReadableSendError } from './xmtp.messageSend.core';
import { sendableConvOfLine } from './xmtp.find';
import { accountClient } from './xmtp.account';

const prep = makeAttachmentPrep(encryptFile, storeEncrypted);

export const { prepare: prepareAttachments, upload: uploadAttachments, forget: forgetAttachments } = prep;

export async function xmtpSendMultiRemoteAttachment(
  line: string,
  files: LocalAttachmentInput[],
  onUploaded?: OnAttachmentsUploaded,
  beforeSend?: () => Promise<void>,
  replyTo?: string,
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const session = await accountClient();
  const id = await withReadableSendError(() =>
    sendPreparedAttachment({
      assertCurrent: session.assertCurrent,
      uploaded: () => prep.uploaded(files),
      onUploaded,
      beforeSend,
      find: () => sendableConvOfLine(line),
      send: (conv, infos) => {
        if (replyTo === undefined) return sendFiles(conv, infos);
        const info = infos[0];
        if (infos.length !== 1 || info === undefined) throw new Error('A file reply needs one attachment.');
        return sendFileReply(conv, replyTo, info);
      },
    }),
  );
  prep.forget(files);
  return id;
}
