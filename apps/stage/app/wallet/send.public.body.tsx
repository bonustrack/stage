import { useEffect, useMemo, useState } from 'react';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import {
  basicRoot, sendFields,
  WALLET_SEND_FIELD_ACTION, WALLET_SEND_FIELD_CHANGE,
} from '@stage-labs/views';
import { toggleAmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { usePalette } from '../../lib/theme';
import { Col } from '../../components/layout';
import { TxStatus } from './send.fields';
import { RecipientRow, ContactsModal, ContactsButton } from './send.recipient';
import { usePublicSend } from './send.public';
import { useSelectedBalance, type TokenChoice } from './TokenSelector';
import type { FooterState } from './wallet.form';

function toggleAmount(
  amount: string, mode: 'eth' | 'usd', priceUsd: number | null,
  setAmount: (v: string) => void, setMode: (fn: (m: 'eth' | 'usd') => 'eth' | 'usd') => void,
): void {
  const next = toggleAmountUnit(amount, mode === 'eth' ? 'primary' : 'usd', priceUsd);
  const nextMode: 'eth' | 'usd' = next.unit === 'primary' ? 'eth' : 'usd';
  if (next.amount !== amount) setAmount(next.amount);
  setMode(() => nextMode);
}

export function PublicSendBody({ token, initialTo, onFooter }: {
  token: TokenChoice; initialTo: string;
  onFooter?: (s: FooterState) => void;
}): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();
  const [picking, setPicking] = useState(false);

  const balance = useSelectedBalance('combined', token);
  const p = usePublicSend(initialTo, token, balance);

  const submitLabel = p.txState === 'submitting' ? 'Confirm in wallet…'
    : p.txState === 'pending' ? 'Sending…'
    : p.txState === 'confirmed' ? 'Sent ✓'
    : 'Send';
  useEffect(() => {
    onFooter?.({
      submitLabel, onSubmit: p.onSubmit,
      submitDisabled: !p.canSubmit || p.txState === 'confirmed', submitLoading: p.busy,
    });
  }, [onFooter, submitLabel, p.onSubmit, p.canSubmit, p.txState, p.busy]);

  const node = useMemo(() => basicRoot(sendFields({
    recipient: p.to,
    amount: p.amount,
    unitLabel: p.mode === 'eth' ? token.symbol : 'USD',
    resolving: p.resolving,
    recipientError: p.resolveErr ?? undefined,
    secondaryLabel: p.secondaryLabel || undefined,
    balanceLabel: p.ethBalance
      ? `Balance: ${Number(p.ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}`
      : undefined,
    maxDisabled: !p.ethBalance,
  })), [p.to, p.amount, p.mode, p.resolving, p.resolveErr, p.secondaryLabel, p.ethBalance, token.symbol]);

  const actions: PayloadHandlers = useMemo(() => ({
    [WALLET_SEND_FIELD_CHANGE]: (payload) => {
      if (payload.field === 'recipient' && typeof payload.recipient === 'string') p.setTo(payload.recipient);
      else if (payload.field === 'amount' && typeof payload.amount === 'string') p.setAmount(payload.amount);
    },
    [WALLET_SEND_FIELD_ACTION]: (payload) => {
      if (payload.action === 'max') p.onMax();
      else if (payload.action === 'toggleUnit') toggleAmount(p.amount, p.mode, p.ethPriceUsd, p.setAmount, p.setMode);
    },
  }), [p]);

  return (
    <Col gap={8}>
      <ViewHost node={node} actions={actions} />

      {p.resolved ? (
        <RecipientRow address={p.resolved} pal={{ head, sub: fg, border }} />
      ) : null}

      <ContactsButton color={fg} border={border} onPress={() => { setPicking(true); }} />

      <TxStatus txState={p.txState} txHash={p.txHash} txErr={p.txErr} />

      <ContactsModal
        visible={picking}
        onClose={() => { setPicking(false); }}
        onPick={(addr) => { p.setTo(addr); }}
        pal={{ head, sub: fg, border }}
      />
    </Col>
  );
}
