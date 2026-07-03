import { Pressable } from '@stage-labs/kit/react-native/pressable';

import * as Clipboard from 'expo-clipboard';
import { Text } from '@stage-labs/kit/react-native/text';
import { Col, Row } from '../layout';
import { flash } from '../../lib/toast';
import { isRailgunAvailable } from '../../lib/railgun/native';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { useDebugConsole } from '../../lib/railgun/debugConsole';
import { BridgePingProbe } from './WalletScreen.private.ping';
import { RailgunDebugPanel } from './WalletScreen.private.debug';

const short0zk = (a: string): string => (a.length> 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a);

export function PrivateView({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement {
  const { snapshot, pending } = usePrivateWallet(true);
  const live = pending.filter(p => p.phase === 'proving' || p.phase === 'broadcasting');
  const debug = useDebugConsole();

  if (!isRailgunAvailable() && !isBridgeAvailable()) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center" gap={6}>
        <Text weight="semibold" size="md" color={head}>Private balances</Text>
        <Text size="md" role="secondary" style={{ textAlign: 'center' }}>
          Shielded transfers arrive in the next app build.
        </Text>
        {}
        {debug ? <BridgePingProbe sub={sub} border={border} /> : null}
      </Col>
    );
  }

  return (
    <Col margin={{ x: 16, top: 4 }}>
      {}
      <Pressable
        onPress={() => {
          if (snapshot?.zkAddress) { void Clipboard.setStringAsync(snapshot.zkAddress); flash('0zk address copied'); }
        }}
        style={{ paddingVertical: 10 }}
      >
        <Text size="xs" role="secondary">PRIVATE ADDRESS</Text>
        <Text weight="semibold" size="md" color={head} style={{ marginTop: 2 }}>
          {snapshot?.zkAddress ? short0zk(snapshot.zkAddress) : '…'}
        </Text>
      </Pressable>

      {}
      {live.map(p => (
        <Row padding={{ y: 8 }} key={p.id} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
          <Text weight="semibold" size="md" color={head}>
            {p.kind === 'shield' ? 'Shielding' : p.kind === 'unshield' ? 'Unshielding' : 'Sending'} {p.symbol}
          </Text>
          <Text size="xs" role="secondary">
            {p.phase === 'proving' ? 'generating proof…' : 'broadcasting…'}
          </Text>
        </Row>
      ))}

      {}

      {}
      {debug ? (
        <>
          <RailgunDebugPanel head={head} sub={sub} border={border} />
          <BridgePingProbe sub={sub} border={border} />
        </>
      ) : null}
    </Col>
  );
}
