import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { Hex } from 'viem';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../../components/layout';
import { DANGER, usePalette } from '../../lib/theme';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';

const PUBLIC_SEND_CHAIN = 1;

type TxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

export function TxStatus(props: {
  txState: TxState; txHash: Hex | null; txErr: string | null;
}): React.ReactElement {
  const { txState, txHash, txErr } = props;
  const { link } = usePalette();
  return (
    <>
      {txHash ? (
        <Box padding={{ x: 4 }} gap={4}>
          <Text size="xs" role="secondary">
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
