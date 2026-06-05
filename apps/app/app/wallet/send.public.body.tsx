/** Public-send body for the unified Wallet → Send token page.
 *
 *  Renders the recipient (address/ENS) + amount fields and the submit/status
 *  for a PUBLIC token transfer (sendNativeOrToken over the connected
 *  Reown/wagmi wallet). The selected token + its balance are owned by the
 *  parent page (the combined TokenSelector) and passed in; all public-send
 *  state + lifecycle live in usePublicSend. Mounted only when the chosen token
 *  is a public balance — the shielded twin routes to SendShieldedBody. */
import { useEffect } from 'react';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  RecipientField, AmountField, TxStatus,
} from './send.fields';
import { usePublicSend } from './send.public';
import { useSelectedBalance, type TokenChoice } from './TokenSelector';
import type { FooterState } from './wallet.form';

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
