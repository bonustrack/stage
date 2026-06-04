/** Header + submit button + tx-status sub-components for the Wallet → Send
 *  screen. Extracted from send.fields.tsx (mechanical split, behavior identical). */
import { Linking, Pressable } from 'react-native';
import type { Hex } from 'viem';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { DANGER } from '../../lib/theme';
import { explorerTxUrl } from '../../lib/railgun/networks';

/** Public sends always broadcast on mainnet (send.public.ts pins chainId 1). */
const PUBLIC_SEND_CHAIN = 1;

type TxState = 'idle' | 'submitting' | 'pending' | 'confirmed';

export function SendHeader(props: {
  fg: string; head: string; border: string; onBack: () => void;
}): React.ReactElement {
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: props.border,
    }}>
      <Pressable onPress={props.onBack} hitSlop={8} style={{ padding: 4 }}>
        <Icon name="arrowLeft" size={22} color={props.fg} />
      </Pressable>
      <Text style={{ color: props.head, fontSize: 18, fontFamily: 'Calibre-Semibold', flex: 1 }}>Send</Text>
    </Box>
  );
}

export function SubmitButton(props: {
  dark: boolean;
  busy: boolean; canSubmit: boolean; txState: TxState; onSubmit: () => void;
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
  return (
    <>
      {/* Tx status: hash link once broadcast, plus errors. */}
      {txHash ? (
        <Box style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium' }}>
            {txState === 'confirmed' ? 'Confirmed' : 'Pending'}
          </Text>
          <Pressable onPress={() => Linking.openURL(explorerTxUrl(PUBLIC_SEND_CHAIN, txHash))} hitSlop={6}>
            <Text style={{ color: '#c0a06e', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
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
