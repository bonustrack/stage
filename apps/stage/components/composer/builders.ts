import { Alert } from 'react-native';
import { isAddress, parseUnits, toHex } from 'viem';
import { base } from 'viem/chains';
import { xmtpSendPoll, xmtpSendTxRequest, xmtpSendSignatureRequest } from '../../modules/messaging';
import { type PollContent, mintPollId, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, buildEip712SignatureRequest, buildPersonalSignatureRequest, signatureRequestFallbackText,
} from '@stage-labs/client/xmtp/sign';
import { type WalletSendCallsContent, walletSendCallsFallbackText } from '@stage-labs/client/xmtp/tx';
import { getActiveAccount } from '../../lib/accounts';
import { setLastAttachment } from '../../lib/lastAttachment';
import type { PostHooks } from './types';
import { mintLocalId } from './send';

export interface PostCtx extends PostHooks { close: () => void }

export interface PollDraft { question: string; header: string; options: string[]; multi: boolean }
export interface SignatureDraft { kind: 'personal' | 'eip712'; desc: string; message: string; json: string }
export interface PaymentDraft { to: string; amount: string; note: string }

async function postStructured(
  post: PostCtx, label: string, text: string, payload: unknown, send: () => Promise<string>,
): Promise<void> {
  const localId = mintLocalId();
  setLastAttachment(label);
  post.onOptimistic?.({ localId, text, attachments: [], payload });
  post.close();
  let sendErr: string | undefined;
  let sentId: string | undefined;
  try { sentId = await send(); }
  catch (e) { sendErr = (e as Error).message; post.setErr(sendErr); }
  finally { post.onSent?.(localId, sendErr, sentId); }
}

function buildSignatureContent(d: SignatureDraft): SignatureRequestContent | null {
  try {
    return d.kind === 'personal'
      ? buildPersonalSignatureRequest(d.message, d.desc)
      : buildEip712SignatureRequest(d.json, d.desc);
  } catch (e) {
    Alert.alert((e as Error).message);
    return null;
  }
}

export async function sendSignatureRequest(d: SignatureDraft, post: PostCtx): Promise<void> {
  const content = buildSignatureContent(d);
  if (!content) return;
  await postStructured(
    post, 'Sign', signatureRequestFallbackText(content),
    { contentType: 'signatureRequest', signatureRequest: content },
    () => xmtpSendSignatureRequest(post.xmtpLine, content),
  );
}

export async function sendPoll(d: PollDraft, post: PostCtx): Promise<void> {
  const question = d.question.trim();
  const options = d.options.map(o => o.trim()).filter(Boolean);
  if (!question || options.length < 2) {
    Alert.alert('Add a question and at least 2 options');
    return;
  }
  const poll: PollContent = {
    pollId: mintPollId(),
    question,
    ...(d.header.trim() ? { header: d.header.trim() } : {}),
    options: options.map(label => ({ label })),
    ...(d.multi ? { multiSelect: true } : {}),
  };
  await postStructured(
    post, 'Poll', pollFallbackText(poll), { contentType: 'poll', poll },
    () => xmtpSendPoll(post.xmtpLine, poll),
  );
}

export async function sendTxRequest(d: PaymentDraft, post: PostCtx): Promise<void> {
  const to = d.to.trim();
  const amount = d.amount.trim();
  if (!isAddress(to)) { Alert.alert('Enter a valid recipient address'); return; }
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) { Alert.alert('Enter a valid amount'); return; }
  const acct = await getActiveAccount();
  if (!acct) { Alert.alert('No active account'); return; }
  const description = d.note.trim() || `Send ${amount} ETH`;
  const wsc: WalletSendCallsContent = {
    version: '1.0',
    chainId: toHex(base.id),
    from: acct.address,
    calls: [{
      to,
      value: toHex(parseUnits(amount, 18)),
      metadata: { description, transactionType: 'transfer', currency: 'ETH', amount: n, decimals: 18, toAddress: to },
    }],
  };
  await postStructured(
    post, 'Payment', walletSendCallsFallbackText(wsc), { contentType: 'walletSendCalls', walletSendCalls: wsc },
    () => xmtpSendTxRequest(post.xmtpLine, wsc),
  );
}
