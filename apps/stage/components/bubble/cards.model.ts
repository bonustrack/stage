import { formatEther } from 'viem';
import { chainIdToNumber, requestAmountOf, type TxAmount, type WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';

function ethFromWeiHex(valueHex?: string): string | undefined {
  if (!valueHex) return undefined;
  try {
    const out = formatEther(BigInt(valueHex));
    return out.includes('.') ? out.replace(/\.?0+$/, '') : out;
  } catch {
    return undefined;
  }
}

export interface TxCallFields {
  target?: string;
  data?: string;
  value?: string;
  eth?: string;
  amount?: TxAmount;
  balanceSymbol?: string;
  needed?: number;
  desc: string;
  rawDesc?: string;
  recipient?: string;
  tokenAddr?: string;
  chainNum: number;
  isErc20Transfer: boolean;
  showDecodedBlock: boolean;
  showBalance: boolean;
}

function balanceNeed(amount: TxAmount | undefined, eth: string | undefined): { balanceSymbol?: string; needed?: number } {
  if (amount) return { balanceSymbol: amount.unit, needed: Number(amount.value) };
  return { balanceSymbol: eth ? 'ETH' : undefined, needed: undefined };
}

function txCallFlags(args: { data?: string; tokenAddr?: string; amount?: TxAmount; eth?: string }): {
  isErc20Transfer: boolean;
  showDecodedBlock: boolean;
  showBalance: boolean;
} {
  const isErc20Transfer = !!args.tokenAddr;
  const hasCalldata = !!args.data && args.data !== '0x';
  return {
    isErc20Transfer,
    showDecodedBlock: hasCalldata && !isErc20Transfer,
    showBalance: !!args.amount || !!args.eth || !!args.tokenAddr,
  };
}

function rawCall(req: WalletSendCallsContent): {
  target?: string;
  data?: string;
  value?: string;
  meta: NonNullable<WalletSendCallsContent['calls'][number]['metadata']>;
} {
  const call = req.calls[0];
  return { target: call?.to, data: call?.data, value: call?.value, meta: call?.metadata ?? {} };
}

export function txCallFields(req: WalletSendCallsContent): TxCallFields {
  const { target, data, value, meta } = rawCall(req);
  const { toAddress, description } = meta;
  const eth = ethFromWeiHex(value);
  const amount = requestAmountOf(req);
  const tokenAddr = toAddress ? target : undefined;
  const desc = description ?? 'Payment request';
  const recipient = toAddress ?? target;
  const chainNum = chainIdToNumber(req.chainId);
  return {
    target,
    data,
    value,
    eth,
    amount,
    desc,
    rawDesc: description,
    recipient,
    tokenAddr,
    chainNum,
    ...balanceNeed(amount, eth),
    ...txCallFlags({ data, tokenAddr, amount, eth }),
  };
}

export function fmtSigValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    if (/^0x[0-9a-fA-F]{42,}$/.test(v) && v.length > 24) return `${v.slice(0, 12)}…${v.slice(-8)}`;
    return v;
  }
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  } catch {
    return '[unserializable]';
  }
}
