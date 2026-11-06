import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { HANDLE_PLACEHOLDER, lookupHint, type PersonLookup } from '@stage-labs/client/identity/personLookup';
import { toggleAmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { usePalette, useEffectiveColorScheme } from '../../../lib/theme';
import { StackHeader } from '../../chrome/StackHeader';
import { FormField } from '../../FormField';
import { Column, Row, ScreenScroll } from '../../layout';
import { SendReview, TxStatus, WalletFooter } from './send.parts';
import { RecipientRow, ContactsModal, ContactsButton } from './send.recipient';
import { TokenSelector, useSendRows } from './TokenSelector';
import { useSend, type SendState } from './useSend';
import { balanceLabelOf, sendRowFor, sendTokenFor, submitLabelFor, unitLabelOf } from './send.model';

const RESOLVING_SPINNER = 24;

function RecipientField({
  value,
  recipient,
  onChange,
}: {
  value: string;
  recipient: PersonLookup;
  onChange: (v: string) => void;
}): React.ReactElement {
  const { sub } = usePalette();
  const hint = lookupHint(recipient);
  return (
    <FormField
      label="Recipient"
      placeholder={HANDLE_PLACEHOLDER}
      value={value}
      onChangeText={onChange}
      inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
      trailing={recipient.kind === 'resolving' ? <Spinner size={RESOLVING_SPINNER} color={sub} /> : undefined}
      hint={hint?.text}
      hintTone={hint?.tone}
    />
  );
}

function AmountField({
  value,
  unitLabel,
  secondaryLabel,
  balanceLabel,
  maxDisabled,
  onChange,
  onMax,
  onToggleUnit,
}: {
  value: string;
  unitLabel: string;
  secondaryLabel?: string;
  balanceLabel?: string;
  maxDisabled: boolean;
  onChange: (v: string) => void;
  onMax: () => void;
  onToggleUnit: () => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  const controls = (
    <Row align="center" gap={8}>
      <Button
        label={unitLabel}
        color="primary"
        variant="soft"
        size="sm"
        pill
        dark={dark}
        iconEnd={<Glyph icon={IconArrowDown} size={18} dark={dark} />}
        onPress={onToggleUnit}
      />
      <Button label="MAX" color="primary" variant="ghost" size="sm" disabled={maxDisabled} dark={dark} onPress={onMax} />
    </Row>
  );
  return (
    <FormField
      label="Amount"
      placeholder="0.0"
      value={value}
      onChangeText={onChange}
      variant="number"
      inputProps={{ keyboardType: 'decimal-pad' }}
      trailing={controls}
      hint={[secondaryLabel, balanceLabel].filter((s) => s !== undefined).join(' · ') || undefined}
    />
  );
}

function toggleUnit(p: SendState): void {
  const next = toggleAmountUnit(p.amount, p.unit, p.priceUsd);
  if (next.amount !== p.amount) p.setAmount(next.amount);
  p.setUnit(next.unit);
}

function SendFields({
  p,
  symbol,
  selector,
  onPickContact,
}: {
  p: SendState;
  symbol: string;
  selector: React.ReactNode;
  onPickContact: () => void;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  return (
    <>
      {selector}
      <Column gap={16}>
        <Column gap={8}>
          <RecipientField value={p.to} recipient={p.recipient} onChange={p.setTo} />
          {p.recipient.kind === 'resolved' ? <RecipientRow address={p.recipient.address} label={p.recipient.label} /> : null}
        </Column>
        <AmountField
          value={p.amount}
          unitLabel={unitLabelOf(p.unit, symbol)}
          secondaryLabel={p.secondaryLabel || undefined}
          balanceLabel={balanceLabelOf(p.balance, symbol)}
          maxDisabled={!p.balance}
          onChange={p.setAmount}
          onMax={p.onMax}
          onToggleUnit={() => {
            toggleUnit(p);
          }}
        />
      </Column>
      <ContactsButton color={fg} border={border} onPress={onPickContact} />
    </>
  );
}

function SendForm({
  symbol,
  row,
  initialTo,
  selector,
  onCancel,
}: {
  symbol: string;
  row: AssetRow | undefined;
  initialTo: string;
  selector: React.ReactNode;
  onCancel: () => void;
}): React.ReactElement {
  const { border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const [picking, setPicking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const p = useSend(initialTo, symbol, row);

  const reviewable = reviewing && p.resolved !== null;
  const onSubmit = (): void => {
    if (reviewable) p.onSubmit();
    else if (p.canSubmit) setReviewing(true);
  };
  const onBack = (): void => {
    if (reviewable && !p.busy && p.txState !== 'confirmed') setReviewing(false);
    else onCancel();
  };

  return (
    <>
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {reviewable ? (
          <SendReview recipient={p.recipient} amount={p.tokenAmountText} symbol={symbol} secondaryLabel={p.secondaryLabel || undefined} />
        ) : (
          <SendFields
            p={p}
            symbol={symbol}
            selector={selector}
            onPickContact={() => {
              setPicking(true);
            }}
          />
        )}
        <TxStatus txState={p.txState} txHash={p.txHash} txErr={p.txErr} />
        <ContactsModal
          visible={picking}
          onClose={() => {
            setPicking(false);
          }}
          onPick={(addr) => {
            p.setTo(addr);
          }}
        />
      </ScreenScroll>
      <WalletFooter
        border={border}
        dark={dark}
        onCancel={onBack}
        cancelLabel={reviewable ? 'Back' : 'Cancel'}
        submitLabel={submitLabelFor(p.txState, reviewable)}
        onSubmit={onSubmit}
        submitDisabled={!p.canSubmit || p.txState === 'confirmed'}
        submitLoading={p.busy}
      />
    </>
  );
}

export function SendScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string; symbol?: string; chainId?: string }>();
  const [symbol, setSymbol] = useState<string>(() => sendTokenFor(params.symbol, params.chainId));
  const initialTo = typeof params.to === 'string' ? params.to : '';
  const rows = useSendRows();

  return (
    <Column surface="surface" weight={1}>
      <StackHeader title="Send token" wallet />
      <SendForm
        key={symbol}
        symbol={symbol}
        row={sendRowFor(rows.rows, symbol)}
        initialTo={initialTo}
        onCancel={() => {
          router.back();
        }}
        selector={<TokenSelector value={symbol} rows={rows} onChange={setSymbol} />}
      />
    </Column>
  );
}
