/**
 * @file Guardian recovery handoff over the existing XMTP text rail (no backend, no new codec): encodes recovery requests/approvals as zero-width-prefixed JSON control lines posted into the recovery conversation.
 */

import { xmtpSendText } from '../xmtp.messages';
import {
  encodeRecoveryMessage,
  type RecoveryApproval,
} from '@stage-labs/client/zerodev/recovery';

/** Post a guardian APPROVAL (their offchain signature) back into the recovery conversation. Returns the sent message id. */
export async function sendRecoveryApproval(line: string, approval: Omit<RecoveryApproval, 'kind'>): Promise<string> {
  return xmtpSendText(line, encodeRecoveryMessage({ kind: 'recovery.approval', ...approval }));
}
