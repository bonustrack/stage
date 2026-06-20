
import { Alert } from 'react-native';
import { isAddress, parseUnits, toHex } from 'viem';
import { xmtpSendPoll, xmtpSendTxRequest, xmtpSendSignatureRequest } from '../modules/messaging';
import { type PollContent, mintPollId, pollFallbackText } from '@stage-labs/client/xmtp/poll';
import {
  type SignatureRequestContent, mintSignatureRequestId, signatureRequestFallbackText,
} from '@stage-labs/client/xmtp/sign';
import {
  type WalletSendCallsContent, walletSendCallsFallbackText,
} from '@stage-labs/client/xmtp/tx';
import { getActiveAccount } from '../lib/accounts';
import { setLastAttachment } from '../lib/lastAttachment';
import type { ComposerActionsArgs } from './MessengerComposer.types';

const mintLocalId = (): string => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function buildPersonalContent(message: string, description: string): SignatureRequestContent | null {
  if (!message) { Alert.alert('Enter a message to sign'); return null; }
  return { id: mintSignatureRequestId(), kind: 'personal', message, ...(description ? { description } : {}) };
}

function buildEip712Content(json: string, description: string): SignatureRequestContent | null {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { Alert.alert('Typed-data JSON is not valid JSON'); return null; }
  const td = parsed as { domain?: unknown; types?: unknown; primaryType?: unknown; message?: unknown };
  if (!td || typeof td !== 'object' || !td.types || !td.primaryType || !td.message) {
    Alert.alert('Typed data needs `types`, `primaryType`, and `message` fields'); return null;
  }
  return {
    id: mintSignatureRequestId(), kind: 'eip712',
    eip712: {
      domain: (td.domain ?? {}) as Record<string, unknown>,
      types: td.types as Record<string, { name: string; type: string }[]>,
      primaryType: td.primaryType as string,
      message: td.message as Record<string, unknown>,
    },
    ...(description ? { description } : {}),
  };
}

export async function sendSignatureRequest(a: ComposerActionsArgs): Promise<void> {
  const description = a.sigDesc.trim();
  const content = a.sigKind === 'personal'
    ? buildPersonalContent(a.sigMessage.trim(), description)
    : buildEip712Content(a.sigJson, description);
  if (!content) return;
  const localId = mintLocalId();
  setLastAttachment('Sign');
  a.onOptimistic?.({ localId, text: signatureRequestFallbackText(content), attachments: [], payload: { contentType: 'signatureRequest', signatureRequest: content } });
  a.setSigOpen(false);
  a.setSigDesc(''); a.setSigMessage(''); a.setSigJson(''); a.setSigKind('personal');
  let sendErr: string | undefined;
  let sentId: string | undefined;
  try { sentId = await xmtpSendSignatureRequest(a.xmtpLine, content); }
  catch (e) { sendErr = (e as Error).message; a.setErr(sendErr); }
  finally { a.onSent?.(localId, sendErr, sentId); }
}

export async function sendPoll(a: ComposerActionsArgs): Promise<void> {
  const question = a.pollQuestion.trim();
  const options = a.pollOptions.map(o => o.trim()).filter(Boolean);
  if (!question || options.length < 2) {
    Alert.alert('Add a question and at least 2 options');
    return;
  }
  const poll: PollContent = {
    pollId: mintPollId(),
    question,
    ...(a.pollHeader.trim() ? { header: a.pollHeader.trim() } : {}),
    options: options.map(label => ({ label })),
    ...(a.pollMulti ? { multiSelect: true } : {}),
  };
  const localId = mintLocalId();
  setLastAttachment('Poll');
  a.onOptimistic?.({ localId, text: pollFallbackText(poll), attachments: [], payload: { contentType: 'poll', poll } });
  a.setPollOpen(false);
  a.setPollQuestion(''); a.setPollHeader(''); a.setPollOptions(['', '']); a.setPollMulti(false);
  let sendErr: string | undefined;
  let sentId: string | undefined;
  try { sentId = await xmtpSendPoll(a.xmtpLine, poll); }
  catch (e) { sendErr = (e as Error).message; a.setErr(sendErr); }
  finally { a.onSent?.(localId, sendErr, sentId); }
}

export async function sendTxRequest(a: ComposerActionsArgs): Promise<void> {
  const to = a.txTo.trim();
  const amount = a.txAmount.trim();
  if (!isAddress(to)) { Alert.alert('Enter a valid recipient address'); return; }
  const n = Number(amount);
  if (!isFinite(n) || n <= 0) { Alert.alert('Enter a valid amount'); return; }
  const acct = await getActiveAccount();
  if (!acct) { Alert.alert('No active account'); return; }
  const description = a.txNote.trim() || `Send ${amount} ETH`;
  const valueHex = toHex(parseUnits(amount, 18));
  const wsc: WalletSendCallsContent = {
    version: '1.0',
    chainId: '0x1',
    from: acct.address,
    calls: [{
      to,
      value: valueHex,
      metadata: { description, transactionType: 'transfer', currency: 'ETH', amount: n, decimals: 18, toAddress: to },
    }],
  };
  const localId = mintLocalId();
  setLastAttachment('Payment');
  a.onOptimistic?.({ localId, text: walletSendCallsFallbackText(wsc), attachments: [], payload: { contentType: 'walletSendCalls', walletSendCalls: wsc } });
  a.setTxOpen(false);
  a.setTxTo(''); a.setTxAmount(''); a.setTxNote('');
  let sendErr: string | undefined;
  let sentId: string | undefined;
  try { sentId = await xmtpSendTxRequest(a.xmtpLine, wsc); }
  catch (e) { sendErr = (e as Error).message; a.setErr(sendErr); }
  finally { a.onSent?.(localId, sendErr, sentId); }
}
