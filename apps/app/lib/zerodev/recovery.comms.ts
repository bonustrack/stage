/** Guardian recovery handoff over the EXISTING XMTP messaging (spec §(d): the
 *  recovery request goes to guardians as messages, they sign in-app, signatures
 *  are posted back into the recovery conversation). No backend / signature-storage
 *  service — XMTP is the only transport.
 *
 *  Reuses the text rail + xmtpSendText (no new codec). The wire format is the
 *  pure encoder in @stage-labs/client/zerodev/recovery (zero-width-prefixed JSON),
 *  so a raw client shows an unobtrusive control line and the app parses it back. */

import { xmtpSendText } from '../xmtp.messages';
import {
  encodeRecoveryMessage,
  type RecoveryApproval,
} from '@stage-labs/client/zerodev/recovery';

/** Post a guardian APPROVAL (their offchain signature) back into the recovery
 *  conversation. Returns the sent message id. */
export async function sendRecoveryApproval(line: string, approval: Omit<RecoveryApproval, 'kind'>): Promise<string> {
  return xmtpSendText(line, encodeRecoveryMessage({ kind: 'recovery.approval', ...approval }));
}
