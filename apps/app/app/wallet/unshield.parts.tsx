/** Presentational sub-parts for the Unshield screen (the public EOA recipient
 *  card + the phase/result line) — split out for the <200-line cap. Mirrors
 *  send.shield.parts.tsx. */
import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { DANGER } from '../../lib/theme';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }
type Phase = 'idle' | 'proving' | 'broadcasting' | 'done' | 'error';

const shortAddr = (a: string): string => (a.length> 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** The unshield recipient is the user's OWN public EOA by default — shown
 *  read-only so funds always return to the user's own wallet. */
export function UnshieldRecipient({ pal, eoa, network }: {
  pal: Pal; eoa: string | null; network: string;
}): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Box gap={6}>
      <Text size="xs" color={sub}>TO YOUR PUBLIC WALLET</Text>
      <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} style={{ borderWidth: 1, borderColor: border }}>
        <Text weight="semibold" size="md" color={head}>
          {eoa ? shortAddr(eoa) : 'Loading address…'}
        </Text>
        <Text size="xs" color={sub} style={{ marginTop: 2 }}>
          {`Unshields to your own ${network} address.`}
        </Text>
      </Box>
    </Box>
  );
}

/** Progress + result line. Proving is the slow Groth16 step; broadcasting then
 *  confirmed shows the explorer link; errors render in red. */
export function UnshieldPhaseLine({ pal, phase, txHash, err, bridgeOk, chainId }: {
  pal: Pal; phase: Phase; txHash: string | null; err: string | null; bridgeOk: boolean; chainId: number;
}): React.ReactElement | null {
  const { sub } = pal;
  if (!bridgeOk) {
    return (
      <Text size="xs" color={sub} style={{ paddingHorizontal: 4 }}>
        Unshielding needs the latest app build.
      </Text>
    );
  }
  return (
    <Box padding={{ x: 4 }} gap={4}>
      {phase === 'proving' ? (
        <Text size="xs" color={sub}>Generating proof… (this can take ~10-30s)</Text>
      ) : phase === 'broadcasting' ? (
        <Text size="xs" color={sub}>Broadcasting…</Text>
      ) : null}
      {txHash ? (
        <Pressable onPress={() => { void Linking.openURL(explorerTxUrl(chainId, txHash)); }} hitSlop={6}>
          <Text size="xs">
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </Text>
        </Pressable>
      ) : null}
      {err ? (
        <Text size="xs" color={DANGER}>{err}</Text>
      ) : null}
    </Box>
  );
}
