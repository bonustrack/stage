
import { xmtpSendText } from '../xmtp.messages';
import {
  encodeRecoveryMessage,
  type RecoveryApproval,
} from '@stage-labs/client/zerodev/recovery';

export async function sendRecoveryApproval(line: string, approval: Omit<RecoveryApproval, 'kind'>): Promise<string> {
  return xmtpSendText(line, encodeRecoveryMessage({ kind: 'recovery.approval', ...approval }));
}
