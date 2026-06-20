/** @file Send-step planner for the MessengerComposer: splits one submission into the separate ordered XMTP messages it produces (text, multi-attachment, per-audio-clip). */

import {
  fileUriToBase64, xmtpReply, xmtpSendAttachment, xmtpSendMultiRemoteAttachment, xmtpSendText,
} from '../modules/messaging';
import { type Attachment, mimeOf, INLINE_ATTACHMENT_MAX_BYTES } from './MessengerComposer.helpers';

let seq = 0;
/** Mint Local Id. */
const mintLocalId = (): string =>
  `tmp_${Date.now()}_${(seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** One planned outbound message: the optimistic content to preview + how to send it. */
export interface SendStep {
  localId: string;
  text: string;
  attachments: Attachment[];
  run: () => Promise<string>;
}

/** Build the ordered list of messages this submission will produce. Order is the on-wire / display order: text first, then the bundled image/video/file attachment message, then each audio clip as its own message. */
export function planSendSteps(
  xmtpLine: string,
  body: string,
  attachments: Attachment[],
  replyTo: string | undefined,
): SendStep[] {
  const steps: SendStep[] = [];
  const multiAtts = attachments.filter((at) => at.kind !== 'audio');
  const audioAtts = attachments.filter((at) => at.kind === 'audio');

  if (body) {
    steps.push({
      localId: mintLocalId(), text: body, attachments: [],
      run: () => (replyTo ? xmtpReply(xmtpLine, replyTo, body) : xmtpSendText(xmtpLine, body)),
    });
  }
  if (multiAtts.length > 0) {
    steps.push({
      localId: mintLocalId(), text: '', attachments: multiAtts,
      run: () => xmtpSendMultiRemoteAttachment(
        xmtpLine,
        multiAtts.map((at) => ({
          fileUri: at.url,
          mimeType: mimeOf(at.mime, at.name ?? at.url),
          filename: at.name ?? at.id,
        })),
      ),
    });
  }
  for (const at of audioAtts) {
    steps.push({
      localId: mintLocalId(), text: '', attachments: [at],
      run: () => sendAudio(xmtpLine, at),
    });
  }
  return steps;
}

/** Sends an audio voice note as an INLINE base64 attachment, intentionally bypassing the remote-attachment strip gate (in-app audio is not an EXIF/location vector like camera images, which still route through xmtpSendMultiRemoteAttachment). */
async function sendAudio(xmtpLine: string, at: Attachment): Promise<string> {
  const mimeType = mimeOf(at.mime, at.name ?? at.url);
  const filename = at.name ?? at.id;
  const dataB64 = await fileUriToBase64(at.url);
  const padding = dataB64.endsWith('==') ? 2 : dataB64.endsWith('=') ? 1 : 0;
  const byteLen = Math.floor((dataB64.length * 3) / 4) - padding;
  if (byteLen > INLINE_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `"${filename}" is too large to send (${(byteLen / (1024 * 1024)).toFixed(1)} MB). `
      + `Attachments must be under ${Math.round(INLINE_ATTACHMENT_MAX_BYTES / 1024)} KB.`,
    );
  }
  return xmtpSendAttachment(xmtpLine, filename, mimeType, dataB64);
}
