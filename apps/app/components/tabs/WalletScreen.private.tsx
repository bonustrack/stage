/** Private (Railgun-shielded) balances view for the Wallet tab.
 *
 *  Renders INSTANTLY from the cached snapshot (no spinner on open): the cached
 *  0zk address + shielded balances paint immediately, optimistic pending
 *  shields/sends are overlaid live with a non-blocking progress chip, and a
 *  background refresh swaps in fresh numbers. On a build without the Railgun
 *  native module it shows a friendly "coming soon" rather than erroring. */
import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Col, Row } from '../layout';
import { flash } from '../../lib/toast';
import { isRailgunAvailable } from '../../lib/railgun/native';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';
import { fmtBalance } from './WalletScreen.parts';

const short0zk = (a: string): string => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a);

export function PrivateView({ head, sub, border }: {
  head: string; sub: string; border: string;
}): React.ReactElement {
  const { snapshot, pending } = usePrivateWallet();
  const live = pending.filter(p => p.phase === 'proving' || p.phase === 'broadcasting');

  if (!isRailgunAvailable()) {
    return (
      <Col mx={16} py={40} align="center" gap={6}>
        <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>Private balances</Text>
        <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', textAlign: 'center' }}>
          Shielded transfers arrive in the next app build.
        </Text>
      </Col>
    );
  }

  return (
    <Col mx={16} mt={4}>
      {/* 0zk address pill — copyable; rendered from cache so it's instant. */}
      <Pressable
        onPress={() => { if (snapshot?.zkAddress) flash('0zk address copied'); }}
        style={{ paddingVertical: 10 }}
      >
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>PRIVATE ADDRESS</Text>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold', marginTop: 2 }}>
          {snapshot?.zkAddress ? short0zk(snapshot.zkAddress) : '…'}
        </Text>
      </Pressable>

      {/* Non-blocking pending indicator — the screen never freezes during the
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

      {snapshot?.balances.length
        ? snapshot.balances.map(b => (
          <Row key={`${b.chainId}:${b.symbol}`} align="center" justify="between" py={14}
            style={{ borderBottomWidth: 1, borderBottomColor: border }}>
            <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>{b.name}</Text>
            <Text style={{ color: head, fontSize: 18, fontFamily: 'Calibre-Semibold' }}>
              {`${fmtBalance(b.balance)} ${b.symbol}`}
            </Text>
          </Row>
        ))
        : (
          <Col py={32} align="center">
            <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium' }}>No shielded balances yet</Text>
          </Col>
        )}
    </Col>
  );
}
