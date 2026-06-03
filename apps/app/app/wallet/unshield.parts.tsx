/** Presentational sub-parts for the Unshield screen (the public EOA recipient
 *  card + the phase/result line) — split out for the <200-line cap. Mirrors
 *  send.shield.parts.tsx. */
import { Linking, Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string }
type Phase = 'idle' | 'proving' | 'broadcasting' | 'done' | 'error';

const shortAddr = (a: string): string => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** The unshield recipient is the user's OWN public EOA by default — shown
 *  read-only so funds always return to the user's own wallet. */
export function UnshieldRecipient({ pal, eoa, network }: {
  pal: Pal; eoa: string | null; network: string;
}): React.ReactElement {
  const { head, sub, border, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>TO YOUR PUBLIC WALLET</Text>
      <Box style={{
        backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: border,
        paddingHorizontal: 14, paddingVertical: 12,
      }}>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
          {eoa ? shortAddr(eoa) : 'Loading address…'}
        </Text>
        <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 2 }}>
          {`Unshields to your own ${network} address.`}
        </Text>
      </Box>
    </Box>
  );
}

/** Progress + result line. Proving is the slow Groth16 step; broadcasting then
 *  confirmed shows the explorer link; errors render in red. */
export function UnshieldPhaseLine({ pal, phase, txHash, err, bridgeOk }: {
  pal: Pal; phase: Phase; txHash: string | null; err: string | null; bridgeOk: boolean;
}): React.ReactElement | null {
  const { sub } = pal;
  if (!bridgeOk) {
    return (
      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 4 }}>
        Unshielding needs the latest app build.
      </Text>
    );
  }
  return (
    <Box style={{ gap: 4, paddingHorizontal: 4 }}>
      {phase === 'proving' ? (
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Generating proof… (this can take ~10-30s)</Text>
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
