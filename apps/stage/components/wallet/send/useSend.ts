import { errorMessage } from '@stage-labs/client/errors';
import { useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { WALLET_ASSETS, type Asset, type AssetRow } from '@stage-labs/client/wallet/assets';
import { BASE_NAMES_ONLY, lookupAddress, type PersonLookup } from '@stage-labs/client/identity/personLookup';
import { buildPublicTransfer } from '@stage-labs/client/wallet/send';
import { tokenAmountFromInput, type AmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { sendCallsFrom, waitForReceipt } from '../../../lib/tx';
import { getActiveAccount } from '../../../lib/accounts';
import { usePersonLookup } from '../../../lib/resolveHandle';
import { maxAmountOf, secondaryLabelOf, sendPriceUsd, type SendTxState } from './send.model';

const NO_SEND_KEY = 'No in-app wallet to send from';

export interface SendState {
  to: string;
  setTo: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  unit: AmountUnit;
  setUnit: (unit: AmountUnit) => void;
  recipient: PersonLookup;
  resolved: string | null;
  tokenAmountText: string;
  balance: string | null;
  priceUsd: number | null;
  secondaryLabel: string;
  canSubmit: boolean;
  busy: boolean;
  txState: SendTxState;
  txHash: Hex | null;
  txErr: string | null;
  onMax: () => void;
  onSubmit: () => void;
}

interface SendTx {
  txState: SendTxState;
  txHash: Hex | null;
  txErr: string | null;
  send: (asset: Asset, resolved: string, tokenAmountText: string) => Promise<void>;
}

function useSendTx(): SendTx {
  const [txState, setTxState] = useState<SendTxState>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const send = async (asset: Asset, resolved: string, tokenAmountText: string): Promise<void> => {
    setTxErr(null);
    setTxHash(null);
    setTxState('submitting');
    try {
      const active = await getActiveAccount();
      if (!active) {
        setTxState('idle');
        setTxErr('No active wallet');
        return;
      }
      const call = buildPublicTransfer({ recipient: resolved, amount: tokenAmountText, asset });
      const sent = await sendCallsFrom(active, [call], { missingKey: NO_SEND_KEY });
      setTxHash(sent.hash);
      setTxState('pending');
      await waitForReceipt(sent.chainId, sent.hash);
      setTxState('confirmed');
    } catch (e) {
      setTxState('idle');
      setTxErr(errorMessage(e));
    }
  };
  return { txState, txHash, txErr, send };
}

export function useSend(initialTo: string, symbol: string, row: AssetRow | undefined): SendState {
  const [to, setTo] = useState<string>(initialTo);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<AmountUnit>('primary');
  const recipient = usePersonLookup(to, BASE_NAMES_ONLY);
  const resolved = lookupAddress(recipient);
  const { txState, txHash, txErr, send } = useSendTx();
  const asset = useMemo(() => WALLET_ASSETS.find((a) => a.symbol === symbol), [symbol]);
  const balance = row?.balance ?? null;
  const priceUsd = sendPriceUsd(symbol, row);

  const tokenAmount = useMemo(() => tokenAmountFromInput(amount, unit, priceUsd), [amount, unit, priceUsd]);
  const secondaryLabel = useMemo(() => secondaryLabelOf(amount, unit, priceUsd, symbol), [amount, unit, priceUsd, symbol]);
  const tokenAmountText = unit === 'primary' ? amount.trim() : String(tokenAmount);
  const busy = txState === 'submitting' || txState === 'pending';
  const canSubmit = !!resolved && tokenAmount > 0 && !!asset;

  const onMax = (): void => {
    const max = maxAmountOf(balance, unit, priceUsd);
    if (max !== null) setAmount(max);
  };

  const onSubmit = (): void => {
    if (!resolved || tokenAmount <= 0 || busy || !asset) return;
    void send(asset, resolved, tokenAmountText);
  };

  return {
    to,
    setTo,
    amount,
    setAmount,
    unit,
    setUnit,
    recipient,
    resolved,
    tokenAmountText,
    balance,
    priceUsd,
    secondaryLabel,
    canSubmit,
    busy,
    txState,
    txHash,
    txErr,
    onMax,
    onSubmit,
  };
}
