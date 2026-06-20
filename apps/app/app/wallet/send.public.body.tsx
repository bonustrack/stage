/** @file Public-send body for the Wallet send page: recipient/amount fields plus submit/status for an on-chain transfer, token from the parent and state from usePublicSend. */
import { useEffect } from 'react';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  RecipientField, AmountField, TxStatus,
} from './send.fields';
import { usePublicSend } from './send.public';
import { useSelectedBalance, type TokenChoice } from './TokenSelector';
import type { FooterState } from './wallet.form';

/** Body for a public (on-chain) token send, owning recipient and amount input. */
export function PublicSendBody({ token, initialTo, onFooter }: {
  token: TokenChoice; initialTo: string;
  /** Report submit state up so the page renders the pinned footer button. */
  onFooter?: (s: FooterState) => void;
}): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const inputBg = border;
  const dark = useEffectiveColorScheme() === 'dark';

  const balance = useSelectedBalance('combined', token);
  const p = usePublicSend(initialTo, token, balance);
  const pal = { fg, head, sub, border, inputBg };

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

  return (
    <>
      <RecipientField
        pal={pal}
        to={p.to}
        setTo={p.setTo}
        resolving={p.resolving}
        resolved={p.resolved}
        resolveErr={p.resolveErr}
      />

      <AmountField
        symbol={token.symbol}
        pal={pal}
        dark={dark}
        amount={p.amount}
        setAmount={p.setAmount}
        mode={p.mode}
        setMode={p.setMode}
        ethBalance={p.ethBalance}
        ethPriceUsd={p.ethPriceUsd}
        secondaryLabel={p.secondaryLabel}
        onMax={p.onMax}
      />

      <TxStatus sub={sub} txState={p.txState} txHash={p.txHash} txErr={p.txErr} />
    </>
  );
}
