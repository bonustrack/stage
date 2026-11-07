import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { HANDLE_PLACEHOLDER, lookupHint } from '@stage-labs/client/identity/personLookup';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';
import { usePalette } from '../../../lib/theme';
import { StackHeader } from '../../chrome/StackHeader';
import { FormField } from '../../FormField';
import { Column, Row, ScreenScroll } from '../../layout';
import { SendReview, TxStatus, WalletFooter } from './send.parts';
import { RecipientRow, ContactsModal, ContactsButton } from './send.recipient';
import { TokenSelector, useSendRows } from './TokenSelector';
import { useSend, type SendState } from './useSend';
import { balanceLabelOf, sendRowFor, sendTokenFor, submitLabelFor, unitLabelOf } from './send.model';

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
  const { text: fg, border, sub } = usePalette();
  const dark = useKitScheme() === 'dark';
  const hint = lookupHint(p.recipient);
  return (
    <>
      {selector}
      <Column gap={16}>
        <Column gap={8}>
          <FormField
            label="Recipient"
            placeholder={HANDLE_PLACEHOLDER}
            value={p.to}
            onChangeText={p.setTo}
            inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
            trailing={p.recipient.kind === 'resolving' ? <Spinner size={24} color={sub} /> : undefined}
            hint={hint?.text}
            hintTone={hint?.tone}
          />
          {p.recipient.kind === 'resolved' ? <RecipientRow address={p.recipient.address} label={p.recipient.label} /> : null}
        </Column>
        <FormField
          label="Amount"
          placeholder="0.0"
          value={p.amount}
          onChangeText={p.setAmount}
          variant="number"
          inputProps={{ keyboardType: 'decimal-pad' }}
          trailing={
            <Row align="center" gap={8}>
              <Button
                label={unitLabelOf(p.unit, symbol)}
                color="primary"
                variant="soft"
                size="sm"
                pill
                dark={dark}
                iconEnd={<Glyph icon={IconArrowDown} size={18} dark={dark} />}
                onPress={p.onToggleUnit}
              />
              <Button label="MAX" color="primary" variant="ghost" size="sm" disabled={!p.balance} dark={dark} onPress={p.onMax} />
            </Row>
          }
          hint={[p.secondaryLabel, balanceLabelOf(p.balance, symbol)].filter(Boolean).join(' · ') || undefined}
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
          onPick={p.setTo}
        />
      </ScreenScroll>
      <WalletFooter
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
