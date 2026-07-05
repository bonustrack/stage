import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { DANGER_COLOR } from '../../lib/uiColors';
import { toggleAmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { usePalette } from '../../lib/theme';
import { Col, Row } from '../../components/layout';
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

function RecipientField({ value, resolving, error, onChange }: {
  value: string; resolving: boolean; error?: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  return (
    <Col gap={6}>
      <Caption value="RECIPIENT" color="secondary" size="sm" />
      <TextField
        name="recipient"
        value={value}
        placeholder="0x… or name.eth"
        dark={scheme === 'dark'}
        onChangeText={onChange}
      />
      {resolving ? <Caption value="Resolving…" color="secondary" /> : null}
      {error === undefined ? null : <Caption value={error} color={DANGER_COLOR[scheme]} />}
    </Col>
  );
}

function AmountField({ value, unitLabel, secondaryLabel, balanceLabel, maxDisabled, onChange, onMax, onToggleUnit }: {
  value: string; unitLabel: string;
  secondaryLabel?: string; balanceLabel?: string; maxDisabled: boolean;
  onChange: (v: string) => void; onMax: () => void; onToggleUnit: () => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  return (
    <Col gap={6}>
      <Row align="center" justify="between">
        <Caption value="AMOUNT" color="secondary" size="sm" />
        <Row align="center" gap={8}>
          <Button
            label={unitLabel}
            color="primary"
            variant="soft"
            size="sm"
            pill
            dark={dark}
            iconEnd={<Icon name="arrowDown" size={18} dark={dark} />}
            onPress={onToggleUnit}
          />
          <Button
            label="MAX"
            color="primary"
            variant="ghost"
            size="sm"
            disabled={maxDisabled}
            dark={dark}
            onPress={onMax}
          />
        </Row>
      </Row>
      <TextField
        name="amount"
        value={value}
        placeholder="0.0"
        dark={dark}
        onChangeText={onChange}
      />
      {secondaryLabel === undefined ? null : <Caption value={secondaryLabel} color="secondary" />}
      {balanceLabel === undefined ? null : <Caption value={balanceLabel} color="secondary" />}
    </Col>
  );
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

  const balanceLabel = p.ethBalance
    ? `Balance: ${Number(p.ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}`
    : undefined;

  return (
    <Col gap={8}>
      <Col gap={16}>
        <RecipientField
          value={p.to}
          resolving={p.resolving}
          error={p.resolveErr ?? undefined}
          onChange={p.setTo}
        />
        <AmountField
          value={p.amount}
          unitLabel={p.mode === 'eth' ? token.symbol : 'USD'}
          secondaryLabel={p.secondaryLabel || undefined}
          balanceLabel={balanceLabel}
          maxDisabled={!p.ethBalance}
          onChange={p.setAmount}
          onMax={p.onMax}
          onToggleUnit={() => { toggleAmount(p.amount, p.mode, p.ethPriceUsd, p.setAmount, p.setMode); }}
        />
      </Col>

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
