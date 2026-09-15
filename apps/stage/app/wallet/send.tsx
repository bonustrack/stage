import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { TextField } from '@stage-labs/kit/react-native/text-field';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { toggleAmountUnit } from '@stage-labs/client/wallet/sendAmount';
import { DANGER_COLOR } from '../../lib/uiColors';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { Col, Row, ScreenScroll } from '../../components/layout';
import { WalletHeader } from '../../components/wallet/WalletHeader';
import { WalletFooter } from './wallet.form';
import { TxStatus } from './send.fields';
import { RecipientRow, ContactsModal, ContactsButton } from './send.recipient';
import { usePublicSend } from './send.public';
import { TokenSelector, useSelectedBalance, useTopToken, type TokenChoice } from './TokenSelector';

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

function submitLabelFor(txState: string): string {
  if (txState === 'submitting') return 'Confirm in wallet…';
  if (txState === 'pending') return 'Sending…';
  if (txState === 'confirmed') return 'Sent ✓';
  return 'Send';
}

function SendForm({ token, initialTo, selector, onCancel }: {
  token: TokenChoice; initialTo: string; selector: React.ReactNode; onCancel: () => void;
}): React.ReactElement {
  const { text: fg, link: head, border } = usePalette();
  const dark = useEffectiveColorScheme() === 'dark';
  const [picking, setPicking] = useState(false);
  const balance = useSelectedBalance(token);
  const p = usePublicSend(initialTo, token, balance);
  const balanceLabel = p.ethBalance
    ? `Balance: ${Number(p.ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${token.symbol}`
    : undefined;
  const pal = { head, sub: fg, border };

  return (
    <>
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {selector}
        <Col gap={16}>
          <RecipientField value={p.to} resolving={p.resolving} error={p.resolveErr ?? undefined} onChange={p.setTo} />
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
        {p.resolved ? <RecipientRow address={p.resolved} pal={pal} /> : null}
        <ContactsButton color={fg} border={border} onPress={() => { setPicking(true); }} />
        <TxStatus txState={p.txState} txHash={p.txHash} txErr={p.txErr} />
        <ContactsModal visible={picking} onClose={() => { setPicking(false); }} onPick={(addr) => { p.setTo(addr); }} pal={pal} />
      </ScreenScroll>
      <WalletFooter border={border} dark={dark} onCancel={onCancel}
        submitLabel={submitLabelFor(p.txState)} onSubmit={p.onSubmit}
        submitDisabled={!p.canSubmit || p.txState === 'confirmed'} submitLoading={p.busy} />
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
