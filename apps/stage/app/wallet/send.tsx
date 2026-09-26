import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { toggleAmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { Col, Row, ScreenScroll } from '../../components/layout';
import { WalletHeader } from '../../components/wallet/WalletHeader';
import { WalletFooter } from '../../components/wallet/wallet.form';
import { FormField } from '../../components/FormField';
import { TxStatus } from '../../components/wallet/send.fields';
import { RecipientRow, ContactsModal, ContactsButton } from '../../components/wallet/send.recipient';
import { usePublicSend } from '../../components/wallet/send.public';
import { SendReview } from '../../components/wallet/send.review';
import { Spinner } from '../../components/Spinner';
import { RECIPIENT_PLACEHOLDER, recipientHint, type RecipientState } from '../../components/wallet/recipient.model';
import { IconArrowDown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowDown';

const RESOLVING_SPINNER = 24;
import { TokenSelector, useSelectedBalance, useTopToken, type TokenChoice } from '../../components/wallet/TokenSelector';

function toggleAmount(
  amount: string, mode: 'eth' | 'usd', priceUsd: number | null,
  setAmount: (v: string) => void, setMode: (fn: (m: 'eth' | 'usd') => 'eth' | 'usd') => void,
): void {
  const next = toggleAmountUnit(amount, mode === 'eth' ? 'primary' : 'usd', priceUsd);
  const nextMode: 'eth' | 'usd' = next.unit === 'primary' ? 'eth' : 'usd';
  if (next.amount !== amount) setAmount(next.amount);
  setMode(() => nextMode);
}

function RecipientField({ value, recipient, onChange }: {
  value: string; recipient: RecipientState; onChange: (v: string) => void;
}): React.ReactElement {
  const { sub } = usePalette();
  const hint = recipientHint(recipient);
  return (
    <FormField label="Recipient" placeholder={RECIPIENT_PLACEHOLDER} value={value} onChangeText={onChange}
      inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
      trailing={recipient.kind === 'resolving' ? <Spinner size={RESOLVING_SPINNER} color={sub} /> : undefined}
      hint={hint?.text} hintTone={hint?.tone} />
  );
}

function AmountField({ value, unitLabel, secondaryLabel, balanceLabel, maxDisabled, onChange, onMax, onToggleUnit }: {
  value: string; unitLabel: string;
  secondaryLabel?: string; balanceLabel?: string; maxDisabled: boolean;
  onChange: (v: string) => void; onMax: () => void; onToggleUnit: () => void;
}): React.ReactElement {
  const scheme = useKitScheme();
  const dark = scheme === 'dark';
  const controls = (
    <Row align="center" gap={8}>
      <Button label={unitLabel} color="primary" variant="soft" size="sm" pill dark={dark}
        iconEnd={<Glyph icon={IconArrowDown} size={18} dark={dark} />} onPress={onToggleUnit} />
      <Button label="MAX" color="primary" variant="ghost" size="sm" disabled={maxDisabled} dark={dark} onPress={onMax} />
    </Row>
  );
  return (
    <FormField label="Amount" placeholder="0.0" value={value} onChangeText={onChange} inputType="number"
      inputProps={{ keyboardType: 'decimal-pad' }} trailing={controls}
      hint={[secondaryLabel, balanceLabel].filter((s) => s !== undefined).join(' · ') || undefined} />
  );
}

function submitLabelFor(txState: string, reviewing: boolean): string {
  if (txState === 'submitting') return 'Confirm in wallet…';
  if (txState === 'pending') return 'Sending…';
  if (txState === 'confirmed') return 'Sent ✓';
  return reviewing ? 'Send' : 'Review';
}

function SendForm({ token, initialTo, selector, onCancel }: {
  token: TokenChoice; initialTo: string; selector: React.ReactNode; onCancel: () => void;
}): React.ReactElement {
  const { border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const [picking, setPicking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const balance = useSelectedBalance(token);
  const p = usePublicSend(initialTo, token, balance);
  const balanceLabel = p.ethBalance
    ? `Balance: ${Number(p.ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}`
    : undefined;

  const reviewable = reviewing && p.resolved !== null;
  const onSubmit = (): void => { if (reviewable) p.onSubmit(); else if (p.canSubmit) setReviewing(true); };
  const onBack = (): void => { if (reviewable && !p.busy && p.txState !== 'confirmed') setReviewing(false); else onCancel(); };

  return (
    <>
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {reviewable ? (
          <SendReview recipient={p.recipient} amount={p.tokenAmountText} symbol={token.symbol}
            secondaryLabel={p.secondaryLabel || undefined} chainId={token.chainId} />
        ) : (
          <SendFields p={p} token={token} selector={selector} balanceLabel={balanceLabel}
            onPickContact={() => { setPicking(true); }} />
        )}
        <TxStatus txState={p.txState} txHash={p.txHash} txChainId={p.txChainId} txErr={p.txErr} />
        <ContactsModal visible={picking} onClose={() => { setPicking(false); }} onPick={(addr) => { p.setTo(addr); }} />
      </ScreenScroll>
      <WalletFooter border={border} dark={dark} onCancel={onBack} cancelLabel={reviewable ? 'Back' : 'Cancel'}
        submitLabel={submitLabelFor(p.txState, reviewable)} onSubmit={onSubmit}
        submitDisabled={!p.canSubmit || p.txState === 'confirmed'} submitLoading={p.busy} />
    </>
  );
}

function SendFields({ p, token, selector, balanceLabel, onPickContact }: {
  p: ReturnType<typeof usePublicSend>; token: TokenChoice; selector: React.ReactNode; balanceLabel?: string;
  onPickContact: () => void;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  return (
    <>
      {selector}
      <Col gap={16}>
        <Col gap={8}>
          <RecipientField value={p.to} recipient={p.recipient} onChange={p.setTo} />
          {p.recipient.kind === 'resolved' ? <RecipientRow address={p.recipient.address} label={p.recipient.label} /> : null}
        </Col>
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
      <ContactsButton color={fg} border={border} onPress={onPickContact} />
    </>
  );
}

export default function WalletSend(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string; symbol?: string; chainId?: string }>();

  const hasParamToken = typeof params.symbol === 'string' && params.symbol.length > 0;
  const initial = useMemo<TokenChoice>(() => {
    const symbol = typeof params.symbol === 'string' && params.symbol.length > 0 ? params.symbol : 'ETH';
    const chainId = typeof params.chainId === 'string' && Number.isFinite(Number(params.chainId))
      ? Number(params.chainId) : 1;
    return { symbol, chainId };
  }, [params.symbol, params.chainId]);

  const [token, setToken] = useState<TokenChoice>(initial);
  const topToken = useTopToken();
  const touched = useRef(hasParamToken);
  useEffect(() => {
    if (touched.current || !topToken) return;
    touched.current = true;
    setToken(topToken);
  }, [topToken]);
  const onChange = (v: TokenChoice): void => { touched.current = true; setToken(v); };
  const initialTo = typeof params.to === 'string' ? params.to : '';

  return (
    <Col surface="surface" flex={1}>
      <WalletHeader title="Send token" />
      <SendForm key={`${token.chainId}:${token.symbol}`} token={token} initialTo={initialTo} onCancel={() => { router.back(); }}
        selector={<TokenSelector value={token} onChange={onChange}/>} />
    </Col>
  );
}
