/** Shield (public → private) form for the Wallet → Send screen.
 *
 *  Deposits a PUBLIC token into the user's OWN 0zk shielded balance. The
 *  recipient is ALWAYS the user's own 0zk address (locked, shown read-only) —
 *  never an arbitrary recipient. Defaults to Sepolia (testnet) for the first
 *  on-chain write. Token (ETH/USDC) + amount are user-chosen; confirm runs
 *  shieldToPrivate() and surfaces estimating → broadcasting → confirmed/failed.
 *
 *  Presentational state is local; the heavy lifting is in lib/railgun/shield.ts.
 *  The pending-action chip on the Private tab also reflects the same flow. */
import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Box } from '../../components/layout';
import { shieldToPrivate } from '../../lib/railgun/shield';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { ShieldRecipient, ShieldPhaseLine } from './send.shield.parts';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string }
type Phase = 'idle' | 'working' | 'broadcasting' | 'done' | 'error';

const SYMBOLS = ['ETH', 'USDC'] as const;
const NETS = [{ id: 11155111, label: 'Sepolia' }, { id: 1, label: 'Ethereum' }] as const;

export function ShieldForm({ pal, dark, zkAddress }: {
  pal: Pal; dark: boolean; zkAddress: string | null;
}): React.ReactElement {
  const { fg, head, sub, border, inputBg } = pal;
  const [symbol, setSymbol] = useState<'ETH' | 'USDC'>('ETH');
  const [chainId, setChainId] = useState<number>(11155111);
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const n = Number(amount);
  const busy = phase === 'working' || phase === 'broadcasting';
  const canSubmit = !!zkAddress && isFinite(n) && n > 0 && !busy && isBridgeAvailable();

  const onSubmit = (): void => {
    if (!canSubmit) return;
    setErr(null); setTxHash(null); setPhase('working');
    void (async (): Promise<void> => {
      try {
        const res = await shieldToPrivate({ chainId, symbol, amount: amount.trim() });
        setTxHash(res.txHash); setPhase('done');
      } catch (e) {
        setErr((e as Error).message ?? 'Shield failed'); setPhase('error');
      }
    })();
  };

  return (
    <Box style={{ gap: 16 }}>
      <ShieldRecipient pal={pal} zkAddress={zkAddress} />

      <Box style={{ gap: 6 }}>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>NETWORK</Text>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {NETS.map(net => (
            <Pressable key={net.id} onPress={() => setChainId(net.id)} style={{
              flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
              borderWidth: 1, borderColor: chainId === net.id ? '#c0a06e' : border,
              backgroundColor: chainId === net.id ? 'rgba(192,160,110,0.15)' : inputBg,
            }}>
              <Text style={{ color: chainId === net.id ? '#c0a06e' : fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>{net.label}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 6 }}>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>TOKEN</Text>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {SYMBOLS.map(s => (
            <Pressable key={s} onPress={() => setSymbol(s)} style={{
              flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
              borderWidth: 1, borderColor: symbol === s ? '#c0a06e' : border,
              backgroundColor: symbol === s ? 'rgba(192,160,110,0.15)' : inputBg,
            }}>
              <Text style={{ color: symbol === s ? '#c0a06e' : fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>{s}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      <Box style={{ gap: 6 }}>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>AMOUNT</Text>
        <Box style={{ backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
          <TextInput value={amount} onChangeText={setAmount} placeholder="0.0" placeholderTextColor={sub}
            keyboardType="decimal-pad" editable={!busy}
            style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold', padding: 0 }} />
        </Box>
      </Box>

      <Button variant="primary" size="lg" fullWidth pill dark={dark} loading={busy}
        disabled={!canSubmit} onPress={onSubmit}
        label={phase === 'working' ? 'Shielding…' : phase === 'broadcasting' ? 'Broadcasting…'
          : phase === 'done' ? 'Shielded ✓' : 'Shield to private'}
        style={{ marginTop: 4 }} />

      <ShieldPhaseLine pal={pal} phase={phase} txHash={txHash} err={err} bridgeOk={isBridgeAvailable()} />
    </Box>
  );
}
