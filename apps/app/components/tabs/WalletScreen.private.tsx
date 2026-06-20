/** @file Private (Railgun-shielded) Wallet tab view rendering the cached 0zk address, live pending-proof chips, and the dev bridge probe, while booting usePrivateWallet so the shared snapshot the Tokens tab reads gets populated. */
import { Pressable } from '@stage-labs/kit/pressable';

import * as Clipboard from 'expo-clipboard';
import { Text } from '@stage-labs/kit/text';
import { Col, Row } from '../layout';
import { flash } from '../../lib/toast';
import { isRailgunAvailable } from '../../lib/railgun/native';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { useDebugConsole } from '../../lib/railgun/debugConsole';
import { BridgePingProbe } from './WalletScreen.private.ping';
import { RailgunDebugPanel } from './WalletScreen.private.debug';

/** Short0zk helper. */
const short0zk = (a: string): string => (a.length> 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a);

/** Wallet view showing the user's private (Railgun) balances and actions. */
export function PrivateView({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement {
  /** autoStart:true is safe — this view mounts only on an explicit Private-tab open, and usePrivateWallet serializes the nodejs-mobile boot behind XMTP readiness so it never races Client.create on first launch. */
  const { snapshot, pending } = usePrivateWallet(true);
  const live = pending.filter(p => p.phase === 'proving' || p.phase === 'broadcasting');
  /** Debug console is OFF by default (Settings → Developer); when off neither diagnostic block mounts, so no high-frequency bridge subscription registers and nothing accumulates (the source of the lag). */
  const debug = useDebugConsole();

  /** The real view needs EITHER the native prover or just the embedded Node bridge (engine init + 0zk address + balance scan, no proof for phase 1-2); only a build with neither shows the placeholder. */
  if (!isRailgunAvailable() && !isBridgeAvailable()) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: 16 }} align="center" gap={6}>
        <Text weight="semibold" size="md" color={head}>Private balances</Text>
        <Text size="md" color={sub} style={{ textAlign: 'center' }}>
          Shielded transfers arrive in the next app build.
        </Text>
        {/* Bridge ping works without the native prover so Less can test the nodejs-mobile round-trip on a prover-less build; gated behind the debug-console toggle (off by default). */}
        {debug ? <BridgePingProbe sub={sub} border={border} /> : null}
      </Col>
    );
  }

  return (
    <Col margin={{ x: 16, top: 4 }}>
      {/* 0zk address pill - copyable; rendered from cache so it's instant. */}
      <Pressable
        onPress={() => {
          if (snapshot?.zkAddress) { void Clipboard.setStringAsync(snapshot.zkAddress); flash('0zk address copied'); }
        }}
        style={{ paddingVertical: 10 }}
      >
        <Text size="xs" color={sub}>PRIVATE ADDRESS</Text>
        <Text weight="semibold" size="md" color={head} style={{ marginTop: 2 }}>
          {snapshot?.zkAddress ? short0zk(snapshot.zkAddress) : '…'}
        </Text>
      </Pressable>

      {/* Non-blocking pending indicator: the screen never freezes during the ~20-30s proof; each in-flight action shows its phase here. */}
      {live.map(p => (
        <Row padding={{ y: 8 }} key={p.id} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
          <Text weight="semibold" size="md" color={head}>
            {p.kind === 'shield' ? 'Shielding' : p.kind === 'unshield' ? 'Unshielding' : 'Sending'} {p.symbol}
          </Text>
          <Text size="xs" color={sub}>
            {p.phase === 'proving' ? 'generating proof…' : 'broadcasting…'}
          </Text>
        </Row>
      ))}

      {/* Token BALANCES live solely in the Tokens tab (merged public + shielded list); this view keeps autoStart:true so the engine still inits and scans, populating the shared snapshot the Tokens tab reads. */}

      {/* Raw balance-pipeline diagnostics + Node-bridge ping probe both stream high-frequency bridge logs, so they are gated behind the debug-console toggle (Settings → Developer, OFF by default) to keep the tab smooth. */}
      {debug ? (
        <>
          <RailgunDebugPanel head={head} sub={sub} border={border} />
          <BridgePingProbe sub={sub} border={border} />
        </>
      ) : null}
    </Col>
  );
}
