/** Private (Railgun-shielded) tab for the Wallet - ADDRESS + ACTIONS only.
 *
 *  The shielded token BALANCES are not rendered here anymore; they're merged
 *  into the Tokens tab's flat list (public + Private-badged rows). This view
 *  shows the cached 0zk address (copyable, paints instantly), the live
 *  pending-proof chips for in-flight shield/send/unshield actions, and the DEV
 *  bridge ping probe. It still mounts usePrivateWallet(autoStart:true) so the
 *  engine inits + scans on open - that populates the shared snapshot the Tokens
 *  tab reads. On a build with neither the native prover nor the Node bridge it
 *  shows a friendly "coming soon" rather than erroring. */
import { Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@metro-labs/kit/text';
import { Col, Row } from '../layout';
import { flash } from '../../lib/toast';
import { isRailgunAvailable } from '../../lib/railgun/native';
import { isBridgeAvailable } from '../../lib/railgun/bridge';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { useDebugConsole } from '../../lib/railgun/debugConsole';
import { BridgePingProbe } from './WalletScreen.private.ping';
import { RailgunDebugPanel } from './WalletScreen.private.debug';

const short0zk = (a: string): string => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a);

export function PrivateView({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement {
  // autoStart:true - this view is mounted ONLY on an explicit Private-tab open
  // (WalletScreen renders it behind `tab === 'private'`), so it's safe to boot
  // the nodejs-mobile engine here; usePrivateWallet serializes it behind XMTP
  // readiness so it never races Client.create on first launch.
  const { snapshot, pending } = usePrivateWallet(true);
  const live = pending.filter(p => p.phase === 'proving' || p.phase === 'broadcasting');
  // Debug console is OFF by default (Settings → Developer). When off, neither
  // diagnostic block mounts, so no high-frequency bridge subscription is
  // registered and nothing accumulates - that was the source of the lag.
  const debug = useDebugConsole();

  // The real view needs EITHER the native prover (full proving) OR just the
  // embedded Node bridge (engine init + 0zk address + balance scan - no proof
  // needed for phase 1-2). Only a build with neither shows the placeholder.
  if (!isRailgunAvailable() && !isBridgeAvailable()) {
    return (
      <Col mx={16} py={40} align="center" gap={6}>
        <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>Private balances</Text>
        <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', textAlign: 'center' }}>
          Shielded transfers arrive in the next app build.
        </Text>
        {/* Bridge ping works without the native prover - let Less test the
            nodejs-mobile round-trip even on a prover-less build. Gated behind
            the debug-console toggle (off by default). */}
        {debug ? <BridgePingProbe sub={sub} border={border} /> : null}
      </Col>
    );
  }

  return (
    <Col mx={16} mt={4}>
      {/* 0zk address pill - copyable; rendered from cache so it's instant. */}
      <Pressable
        onPress={() => {
          if (snapshot?.zkAddress) { void Clipboard.setStringAsync(snapshot.zkAddress); flash('0zk address copied'); }
        }}
        style={{ paddingVertical: 10 }}
      >
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>PRIVATE ADDRESS</Text>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold', marginTop: 2 }}>
          {snapshot?.zkAddress ? short0zk(snapshot.zkAddress) : '…'}
        </Text>
      </Pressable>

      {/* Non-blocking pending indicator - the screen never freezes during the
          ~20-30s proof; each in-flight action shows its phase here. */}
      {live.map(p => (
        <Row key={p.id} align="center" gap={8} py={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
          <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
            {p.kind === 'shield' ? 'Shielding' : p.kind === 'unshield' ? 'Unshielding' : 'Sending'} {p.symbol}
          </Text>
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {p.phase === 'proving' ? 'generating proof…' : 'broadcasting…'}
          </Text>
        </Row>
      ))}

      {/* Token BALANCES are no longer rendered here - they live solely in the
          Tokens tab (merged public + shielded flat list). This view keeps
          autoStart:true so the engine still inits + scans, which populates the
          shared snapshot the Tokens tab reads. */}

      {/* Raw balance-pipeline diagnostics + Node-bridge ping probe. Both stream
          high-frequency bridge logs, so they are gated behind the debug-console
          toggle (Settings → Developer, OFF by default) to keep the tab smooth. */}
      {debug ? (
        <>
          <RailgunDebugPanel head={head} sub={sub} border={border} />
          <BridgePingProbe sub={sub} border={border} />
        </>
      ) : null}
    </Col>
  );
}
