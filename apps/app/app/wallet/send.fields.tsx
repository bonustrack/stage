/** Recipient + amount input fields for the Wallet → Send screen.
 *
 *  Extracted from send.tsx (mechanical split, behavior identical). Presentational
 *  only — all state + handlers are owned by the parent screen and passed in. */
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { DANGER } from '../../lib/theme';

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
  const { fg, head, sub, inputBg } = props.pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>RECIPIENT</Text>
      <TextInput
        value={props.to}
        onChangeText={props.setTo}
        placeholder="0x… or name.eth"
        placeholderTextColor={sub}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
          backgroundColor: inputBg, borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 12,
        }}
      />
      {props.resolving ? (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Spinner size={20} color={fg} />
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Resolving…</Text>
        </Box>
      ) : props.resolved ? (
        <Text style={{ color: fg, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          → {props.resolved}
        </Text>
      ) : props.resolveErr ? (
        <Text style={{ color: DANGER, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
          {props.resolveErr}
        </Text>
      ) : null}
    </Box>
  );
}

export function AmountField(props: {
  pal: Palette;
  dark: boolean;
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
          textStyle={{ color: ethBalance ? '#c0a06e' : sub, fontSize: 12 }}
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
            {mode === 'eth' ? 'ETH' : 'USD'}
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
          Balance: {Number(ethBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH
        </Text>
      ) : null}
    </Box>
  );
}

// Re-export header/submit/tx-status sub-components (split into send.actions.tsx
// for the <200-line cap) so existing import paths keep working.
export { SendHeader, SubmitButton, TxStatus } from './send.actions';
