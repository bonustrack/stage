import { useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/pressable';
import { Input } from '@stage-labs/kit/input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Hex } from 'viem';
import { Text } from '@stage-labs/kit/text';
import { Box, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { Button } from '@stage-labs/kit/button';
import { Icon } from '@stage-labs/kit/icon';
import { DANGER, usePalette } from '../../lib/theme';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { RecipientRow, ContactsModal, ContactsButton } from './send.recipient';

interface Palette {
  fg: string; head: string; sub: string; border: string; inputBg: string;
}

export function RecipientField(props: {
  pal: Palette;
  to: string;
  setTo: (v: string) => void;
  resolving: boolean;
  resolved: string | null;
  resolveErr: string | null;
}): React.ReactElement {
  const { fg, head, sub, border } = props.pal;
  const [picking, setPicking] = useState(false);
  const rowPal = { head, sub, border };
  return (
    <Box gap={6}>
      <Text size="xs" color={sub}>RECIPIENT</Text>
      {}
      <Row surface="raised" radius="lg" padding={{ x: 6, left: 14 }} align="center" gap={4}>
        <Input
          value={props.to}
          onChangeText={props.setTo}
          placeholder="0x… or name.eth"
          placeholderTextColor={sub}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{
            flex: 1, color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium',
            paddingVertical: 12, paddingHorizontal: 0, backgroundColor: 'transparent',
            minHeight: 0, borderWidth: 0,
          }}
/>
        <ContactsButton color={fg} border={border} onPress={() => { setPicking(true); }}/>
      </Row>

      {}
      {props.resolving ? (
        <Row padding={{ x: 4 }} align="center" gap={8}>
          <Spinner size={20} color={fg}/>
          <Text size="xs" color={sub}>Resolving…</Text>
        </Row>
      ) : props.resolved ? (
        <RecipientRow address={props.resolved} pal={rowPal}/>
      ) : props.resolveErr ? (
        <Text size="xs" color={DANGER} style={{ paddingHorizontal: 4 }}>
          {props.resolveErr}
        </Text>
      ) : null}

      <ContactsModal
        visible={picking}
        onClose={() => { setPicking(false); }}
        onPick={(addr) => { props.setTo(addr); }}
        pal={rowPal}
/>
    </Box>
  );
}

export function AmountField(props: {
  pal: Palette;
  dark: boolean;
  symbol: string;
  amount: string;
  setAmount: (v: string) => void;
  mode: 'eth' | 'usd';
  setMode: (fn: (m: 'eth' | 'usd') => 'eth' | 'usd') => void;
  ethBalance: string | null;
  ethPriceUsd: number | null;
  secondaryLabel: string;
  onMax: () => void;
}): React.ReactElement {
  const { fg, head, sub, border } = props.pal;
  const { amount, mode, ethPriceUsd, setAmount, setMode, ethBalance } = props;
  const { link } = usePalette();
  return (
    <Box gap={6}>
      <Row align="center">
        <Text size="xs" color={sub} style={{ flex: 1 }}>AMOUNT</Text>
        <Button
          variant="ghost"
          size="sm"
          dark={props.dark}
          disabled={!ethBalance}
          onPress={props.onMax}
          label="MAX"
          textStyle={{ color: ethBalance ? link : sub, fontSize: fontSize('xs') }}
          style={{ height: 24, paddingHorizontal: 8 }}
/>
      </Row>

      <Row surface="raised" radius="lg" padding={{ x: 14, y: 12 }} align="center" gap={8}>
        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder="0.0"
          placeholderTextColor={sub}
          inputType="number"
          dark={props.dark}
          inputProps={{ keyboardType: 'decimal-pad' }}
          style={{
            flex: 1, color: head, fontSize: fontSize('xl'), fontFamily: 'Calibre-Semibold',
            padding: 0, backgroundColor: 'transparent', minHeight: 0, borderWidth: 0,
          }}
/>
        {}
        <Pressable
          onPress={() => {
            if (!amount.trim() || !ethPriceUsd) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
            const n = Number(amount);
            if (!isFinite(n) || n <= 0) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
            if (mode === 'eth') {
              setAmount((n * ethPriceUsd).toFixed(2));
              setMode(() => 'usd');
            } else {
              setAmount((n / ethPriceUsd).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''));
              setMode(() => 'eth');
            }
          }}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
            backgroundColor: pressed ? border : 'transparent',
          })}
>
          <Text weight="semibold" size="md" color={head}>
            {mode === 'eth' ? props.symbol : 'USD'}
          </Text>
          <Icon name="arrowDown" size={14} color={fg}/>
        </Pressable>
      </Row>

      {props.secondaryLabel ? (
        <Text size="xs" color={sub} style={{ paddingHorizontal: 4 }}>
          {props.secondaryLabel}
        </Text>
      ) : null}
      {ethBalance ? (
        <Text size="xs" color={sub} style={{ paddingHorizontal: 4 }}>
          Balance: {Number(ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {props.symbol}
        </Text>
      ) : null}
    </Box>
  );
}

const PUBLIC_SEND_CHAIN = 1;

type TxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

export function SendHeader(props: {
  fg: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: props.border }}>
      <Pressable onPress={props.onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={props.fg}/>
      </Pressable>
      <Text weight="semibold" size="xl" color={props.head} style={{ flex: 1 }}>Send token</Text>
    </Row>
  );
}

export function SubmitButton(props: {
  dark: boolean; busy: boolean; canSubmit: boolean; txState: TxState; onSubmit: () => void;
}): React.ReactElement {
  const { txState } = props;
  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      pill
      dark={props.dark}
      loading={props.busy}
      disabled={!props.canSubmit || txState === 'confirmed'}
      onPress={props.onSubmit}
      label={txState === 'submitting' ? 'Confirm in wallet…'
        : txState === 'pending' ? 'Sending…'
        : txState === 'confirmed' ? 'Sent ✓'
        : 'Send'}
      style={{ marginTop: 8 }}
/>
  );
}

export function TxStatus(props: {
  sub: string; txState: TxState; txHash: Hex | null; txErr: string | null;
}): React.ReactElement {
  const { sub, txState, txHash, txErr } = props;
  const { link } = usePalette();
  return (
    <>
      {}
      {txHash ? (
        <Box padding={{ x: 4 }} gap={4}>
          <Text size="xs" color={sub}>
            {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Text>
          <Pressable onPress={() => { void Linking.openURL(explorerTxUrl(PUBLIC_SEND_CHAIN, txHash)); }} hitSlop={6}>
            <Text size="xs" color={link}>
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </Text>
          </Pressable>
        </Box>
      ) : null}
      {txErr ? (
        <Text size="xs" color={DANGER} style={{ paddingHorizontal: 4 }}>
          {txErr}
        </Text>
      ) : null}
    </>
  );
}
