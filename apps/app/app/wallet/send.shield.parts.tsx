/** Presentational sub-parts for the Shield form (locked 0zk recipient + the
 *  phase/result line) — split out of send.shield.tsx for the <200-line cap. */
import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { DANGER } from '../../lib/theme';
import { txExplorerUrl } from '../../lib/railgun/explorer';

interface Pal { fg: string; head: string; sub: string; border: string; inputBg: string; link: string }

const short0zk = (a: string): string => (a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a);

/** The shield recipient is ALWAYS the user's own 0zk — shown read-only/locked
 *  so it can never be a third party. */
export function ShieldRecipient({ pal, zkAddress }: {
  pal: Pal; zkAddress: string | null;
}): React.ReactElement {
  const { head, sub, border, inputBg } = pal;
  return (
    <Box style={{ gap: 6 }}>
      <Text size="sm" style={{ color: sub }}>TO YOUR PRIVATE WALLET</Text>
      <Box style={{
        backgroundColor: inputBg, borderRadius: 12, borderWidth: 1, borderColor: border,
        paddingHorizontal: 14, paddingVertical: 12,
      }}>
        <Text weight="semibold" size="md" style={{ color: head }}>
          {zkAddress ? short0zk(zkAddress) : 'Loading 0zk address…'}
        </Text>
        <Text size="sm" style={{ color: sub, marginTop: 2 }}>
          Locked — shields deposit to your own shielded balance.
        </Text>
      </Box>
    </Box>
  );
}

/** Result line shown alongside the stepper: the "needs latest build" notice when
 *  the bridge is absent, the chain-aware explorer tx link once broadcast, and a
 *  clear error message on failure. The per-phase progress text now lives in the
 *  <ShieldStepper>; this line carries only the link + error + bridge notice. */
export function ShieldPhaseLine({ pal, txHash, err, errPhase, bridgeOk, chainId }: {
  pal: Pal; txHash: string | null; err: string | null; errPhase?: string | null;
  bridgeOk: boolean; chainId: number;
}): React.ReactElement | null {
  const { sub, link } = pal;
  if (!bridgeOk) {
    return (
      <Text size="sm" style={{ color: sub, paddingHorizontal: 4 }}>
        Shielding needs the latest app build.
      </Text>
    );
  }
  if (!txHash && !err) return null;
  return (
    <Box style={{ gap: 4, paddingHorizontal: 4 }}>
      {txHash ? (
        <Pressable onPress={() => Linking.openURL(txExplorerUrl(chainId, txHash))} hitSlop={6}>
          <Text size="sm" style={{ color: link }}>
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </Text>
        </Pressable>
      ) : null}
      {err ? (
        <>
          <Text size="sm" style={{ color: DANGER }} selectable>{err}</Text>
          {errPhase ? (
            <Text size="xs" style={{ color: sub }}>Failed at: {errPhase}</Text>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
