/** Presentational sub-parts for the Shield form (locked 0zk recipient + the
 *  phase/result line) — split out of send.shield.tsx for the <200-line cap. */
import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string }
type Phase = 'idle' | 'working' | 'broadcasting' | 'done' | 'error';

const short0zk = (a: string): string => (a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);

/** Public-send vs Shield (public → own 0zk) segmented toggle at the top of the
 *  Send screen. */
export function SendModeToggle({ pal, mode, setMode }: {
  pal: Pal; mode: 'public' | 'shield'; setMode: (m: 'public' | 'shield') => void;
}): React.ReactElement {
  const { fg, border, inputBg } = pal;
  const opts: ReadonlyArray<readonly [('public' | 'shield'), string]> = [
    ['public', 'Send'], ['shield', 'Shield to private'],
  ];
  return (
    <Box style={{ flexDirection: 'row', gap: 8 }}>
      {opts.map(([id, label]) => (
        <Pressable key={id} onPress={() => setMode(id)} style={{
          flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
          borderWidth: 1, borderColor: mode === id ? '#c0a06e' : border,
          backgroundColor: mode === id ? 'rgba(192,160,110,0.15)' : inputBg,
        }}>
          <Text style={{ color: mode === id ? '#c0a06e' : fg, fontSize: 14, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
        </Pressable>
      ))}
    </Box>
  );
}

/** The shield recipient is ALWAYS the user's own 0zk — shown read-only/locked
 *  so it can never be a third party. */
export function ShieldRecipient({ pal, zkAddress }: {
  pal: Pal; zkAddress: string | null;
}): React.ReactElement {
  const { head, sub, border, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>TO YOUR PRIVATE WALLET</Text>
      <Box style={{
        backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: border,
        paddingHorizontal: 14, paddingVertical: 12,
      }}>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
          {zkAddress ? short0zk(zkAddress) : 'Loading 0zk address…'}
        </Text>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          Locked — shields deposit to your own shielded balance.
        </Text>
      </Box>
    </Box>
  );
}

/** Progress + result line: working/broadcasting hint, the explorer tx link on
 *  success, and a clear error on failure. */
export function ShieldPhaseLine({ pal, phase, txHash, err, bridgeOk }: {
  pal: Pal; phase: Phase; txHash: string | null; err: string | null; bridgeOk: boolean;
}): React.ReactElement | null {
  const { sub } = pal;
  if (!bridgeOk) {
    return (
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
        Shielding needs the latest app build.
      </Text>
    );
  }
  return (
    <Box style={{ gap: 4, paddingHorizontal: 4 }}>
      {phase === 'working' ? (
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Preparing shield…</Text>
      ) : phase === 'broadcasting' ? (
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Broadcasting…</Text>
      ) : null}
      {txHash ? (
        <Pressable onPress={() => Linking.openURL(`https://etherscan.io/tx/${txHash}`)} hitSlop={6}>
          <Text style={{ color: '#c0a06e', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </Text>
        </Pressable>
      ) : null}
      {err ? (
        <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium' }}>{err}</Text>
      ) : null}
    </Box>
  );
}
