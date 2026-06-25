import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Hex } from 'viem';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../../components/layout';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { DANGER, usePalette } from '../../lib/theme';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';

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
