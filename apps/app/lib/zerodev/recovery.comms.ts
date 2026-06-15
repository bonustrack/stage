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
  encodeRecoveryMessage, parseRecoveryMessage,
  type RecoveryRequest, type RecoveryApproval, type RecoveryMessage,
} from '@stage-labs/client/zerodev/recovery';

/** Broadcast a recovery REQUEST to a guardian conversation (the wallet + the new
 *  owner the guardian is asked to approve). Returns the sent message id. */
export async function sendRecoveryRequest(line: string, req: Omit<RecoveryRequest, 'kind'>): Promise<string> {
  return xmtpSendText(line, encodeRecoveryMessage({ kind: 'recovery.request', ...req }));
}

/** Post a guardian APPROVAL (their offchain signature) back into the recovery
 *  conversation. Returns the sent message id. */
export async function sendRecoveryApproval(line: string, approval: Omit<RecoveryApproval, 'kind'>): Promise<string> {
  return xmtpSendText(line, encodeRecoveryMessage({ kind: 'recovery.approval', ...approval }));
}

/** Parse an inbound XMTP text line as a recovery control message, or null if it
 *  is ordinary chat. (Re-export of the pure parser for the message-stream side.) */
export function parseRecovery(text: string): RecoveryMessage | null {
  return parseRecoveryMessage(text);
}
