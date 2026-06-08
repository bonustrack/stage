/** Recipient + amount input fields for the Wallet → Send screen.
 *
 *  Extracted from send.tsx (mechanical split, behavior identical). Presentational
 *  only — all state + handlers are owned by the parent screen and passed in. */
import { useState } from 'react';
import { Linking, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Hex } from 'viem';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { DANGER, usePalette } from '../../lib/theme';
import { explorerTxUrl } from '../../lib/railgun/networks';
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
  const { fg, head, sub, border, inputBg } = props.pal;
  const [picking, setPicking] = useState(false);
  const rowPal = { head, sub, border };
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT</Text>
      {/* Input + a contacts-picker icon button on the right. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: inputBg, borderRadius: 12,
        paddingHorizontal: 6, paddingLeft: 14,
      }}>
        <TextInput
          value={props.to}
          onChangeText={props.setTo}
          placeholder="0x… or name.eth"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1, color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
            paddingVertical: 12,
          }}
        />
        <ContactsButton color={fg} border={border} onPress={() => setPicking(true)} />
      </Box>

      {/* Once a valid recipient is resolved, show them as a user row
          (avatar + name + truncated address) — same row the rest of the app
          uses. While resolving / on error, show the inline status line. */}
      {props.resolving ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Spinner size={20} color={fg} />
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Resolving…</Text>
        </Box>
      ) : props.resolved ? (
        <RecipientRow address={props.resolved} pal={rowPal} />
      ) : props.resolveErr ? (
        <Text style={{ color: DANGER, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          {props.resolveErr}
        </Text>
      ) : null}

      <ContactsModal
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(addr) => props.setTo(addr)}
        pal={rowPal}
      />
    </Box>
  );
}

export function AmountField(props: {
  pal: Palette;
  dark: boolean;
  /** Symbol of the currently selected token — labels the amount toggle + balance. */
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
  const { fg, head, sub, border, inputBg } = props.pal;
  const { amount, mode, ethPriceUsd, setAmount, setMode, ethBalance } = props;
  const { link } = usePalette();
  return (
    <Box style={{ gap: 6 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', flex: 1 }}>AMOUNT</Text>
        <Button
          variant="ghost"
          size="sm"
          dark={props.dark}
          disabled={!ethBalance}
          onPress={props.onMax}
          label="MAX"
          textStyle={{ color: ethBalance ? link : sub, fontSize: 12 }}
          style={{ height: 24, paddingHorizontal: 8 }}
        />
      </Box>

      <Box style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: inputBg, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, gap: 8,
      }}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.0"
          placeholderTextColor={sub}
          keyboardType="decimal-pad"
          style={{
            flex: 1, color: head, fontSize: 18, fontFamily: 'Calibre-Semibold',
            padding: 0,
          }}
        />
        {/* Mode toggle — pressing it flips ETH↔USD and converts the
            current value so the user doesn't lose what they typed. */}
        <Pressable
          onPress={() => {
            if (!amount.trim() || !ethPriceUsd) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
            const n = Number(amount);
            if (!isFinite(n) || n <= 0) { setMode(m => m === 'eth' ? 'usd' : 'eth'); return; }
            if (mode === 'eth') {
              /** ETH → USD: round to cents for UX. */
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
          <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
            {mode === 'eth' ? props.symbol : 'USD'}
          </Text>
          <Icon name="arrowDown" size={14} color={fg} />
        </Pressable>
      </Box>

      {props.secondaryLabel ? (
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          {props.secondaryLabel}
        </Text>
      ) : null}
      {ethBalance ? (
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          Balance: {Number(ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {props.symbol}
        </Text>
      ) : null}
    </Box>
  );
}

/** Public sends always broadcast on mainnet (send.public.ts pins chainId 1). */
const PUBLIC_SEND_CHAIN = 1;

type TxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

export function SendHeader(props: {
  fg: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { toolbarBg } = usePalette();
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: props.border,
      backgroundColor: toolbarBg,
    }}>
      <Pressable onPress={props.onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={props.fg} />
      </Pressable>
      <Text style={{ color: props.head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Send token</Text>
    </Box>
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
      {/* Tx status: hash link once broadcast, plus errors. */}
      {txHash ? (
        <Box style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
            {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Text>
          <Pressable onPress={() => Linking.openURL(explorerTxUrl(PUBLIC_SEND_CHAIN, txHash))} hitSlop={6}>
            <Text style={{ color: link, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
              {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </Text>
          </Pressable>
        </Box>
      ) : null}
      {txErr ? (
        <Text style={{ color: DANGER, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          {txErr}
        </Text>
      ) : null}
    </>
  );
}
