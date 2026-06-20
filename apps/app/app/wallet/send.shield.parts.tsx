import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Box } from '../../components/layout';
import { DANGER } from '../../lib/theme';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

const short0zk = (a: string): string => (a.length> 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);

export function ShieldRecipient({ pal, zkAddress }: {
  pal: Pal; zkAddress: string | null;
}): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Box gap={6}>
      <Text size="xs" color={sub}>TO YOUR PRIVATE WALLET</Text>
      <Box surface="raised" radius="lg" padding={{ x: 14, y: 12 }} style={{ borderWidth: 1, borderColor: border }}>
        <Text weight="semibold" size="md" color={head}>
          {zkAddress ? short0zk(zkAddress) : 'Loading 0zk address…'}
        </Text>
        <Text size="xs" color={sub} style={{ marginTop: 2 }}>
          Locked — shields deposit to your own shielded balance.
        </Text>
      </Box>
    </Box>
  );
}

export function ShieldPhaseLine({ pal, txHash, err, errPhase, bridgeOk, chainId }: {
  pal: Pal; txHash: string | null; err: string | null; errPhase?: string | null;
  bridgeOk: boolean; chainId: number;
}): React.ReactElement | null {
  const { sub } = pal;
  if (!bridgeOk) {
    return (
      <Text size="xs" color={sub} style={{ paddingHorizontal: 4 }}>
        Shielding needs the latest app build.
      </Text>
    );
  }
  if (!txHash && !err) return null;
  return (
    <Box padding={{ x: 4 }} gap={4}>
      {txHash ? (
        <Pressable onPress={() => { void Linking.openURL(explorerTxUrl(chainId, txHash)); }} hitSlop={6}>
          <Text size="xs">
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </Text>
        </Pressable>
      ) : null}
      {err ? (
        <>
          <Text size="xs" color={DANGER} selectable>{err}</Text>
          {errPhase ? (
            <Text size="3xs" color={sub}>Failed at: {errPhase}</Text>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
