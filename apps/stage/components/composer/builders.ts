import { parseUnits, toHex } from 'viem';
import { base } from 'viem/chains';
import { xmtpSendPoll, xmtpSendTxRequest, xmtpSendSignatureRequest } from '../../lib/xmtp.messages';
import { type PollContent, mintPollId, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import { capabilities } from '../../lib/capabilities';
import { signatureRequestFallbackText } from '@stage-labs/client/xmtp/sign';
import { type WalletSendCallsContent, walletSendCallsFallbackText } from '@stage-labs/client/xmtp/tx';
import { structuredPayload, type EntryPayload } from '@stage-labs/client/xmtp/entryPayload';
import { getActiveAccount } from '../../lib/accounts';
import { setLastAttachment, type AttachmentId } from '../../lib/drafts';
import type { PostHooks } from './types';
import { mintLocalId } from './outbound';
import {
  checkPaymentDraft,
  checkPollDraft,
  checkSignatureDraft,
  type DraftCheck,
  type PaymentDraft,
  type PollDraft,
  type SignatureDraft,
} from './sheets.model';

export interface PostCtx extends PostHooks {
  close: () => void;
}

function checked<T>(check: DraftCheck<T>): T | null {
  if (check.ok) return check.value;
  capabilities.alert(check.message);
  return null;
}

async function postStructured(
  post: PostCtx,
  attachment: AttachmentId,
  text: string,
  payload: EntryPayload,
  send: (line: string) => Promise<string>,
): Promise<void> {
  const line = await post.openLine();
  if (line === null) return;
  const localId = mintLocalId();
  setLastAttachment(attachment);
  post.onOptimistic?.({ localId, text, attachments: [], payload });
  post.close();
  let sendErr: string | undefined;
  let sentId: string | undefined;
  try {
    sentId = await send(line);
  } catch (e) {
    sendErr = (e as Error).message;
    post.setErr(sendErr);
  } finally {
    post.onSent?.(localId, sendErr, sentId);
  }
}

export async function sendSignatureRequest(d: SignatureDraft, post: PostCtx): Promise<void> {
  const content = checked(checkSignatureDraft(d));
  if (!content) return;
  await postStructured(post, 'sign', signatureRequestFallbackText(content), structuredPayload('signatureRequest', content), (line) =>
    xmtpSendSignatureRequest(line, content),
  );
}

export async function sendPoll(d: PollDraft, post: PostCtx): Promise<void> {
  const fields = checked(checkPollDraft(d));
  if (!fields) return;
  const poll: PollContent = { pollId: mintPollId(), ...fields };
  await postStructured(post, 'poll', pollFallbackText(poll), structuredPayload('poll', poll), (line) => xmtpSendPoll(line, poll));
}

export async function sendTxRequest(d: PaymentDraft, post: PostCtx): Promise<void> {
  const fields = checked(checkPaymentDraft(d));
  if (!fields) return;
  const { to, amount, units: n } = fields;
  const acct = await getActiveAccount();
  if (!acct) {
    capabilities.alert('No active account');
    return;
  }
  const description = d.note.trim() || `Send ${amount} ETH`;
  const wsc: WalletSendCallsContent = {
    version: '1.0',
    chainId: toHex(base.id),
    from: acct.address,
    calls: [
      {
        to,
        value: toHex(parseUnits(amount, 18)),
        metadata: { description, transactionType: 'transfer', currency: 'ETH', amount: n, decimals: 18, toAddress: to },
      },
    ],
  };
  await postStructured(post, 'payment', walletSendCallsFallbackText(wsc), structuredPayload('walletSendCalls', wsc), (line) =>
    xmtpSendTxRequest(line, wsc),
  );
}
