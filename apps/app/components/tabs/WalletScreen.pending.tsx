/** Greyed "pending shield • arriving" placeholder row(s) for the Tokens tab.
 *
 *  Surfaces an in-flight shield (one the user kicked off, OR one detected on the
 *  EOA's mempool/nonce — see usePendingShieldWatch) while it's still being mined
 *  or scanned into the shielded balance. Once the note lands the row disappears
 *  and the real Private-badged balance row reflects the new amount.
 *
 *  Styled to match TokenRow but muted: dimmed text, a small spinner in place of
 *  the avatar, and an "arriving" sub-line. Tapping does nothing (no detail yet). */
import { Text } from '@metro-labs/kit/text';

import { Col, Row, Box } from '../layout';
import { Spinner } from '../Spinner';
import type { PendingAction } from '../../lib/railgun/types';

interface Pal { head: string; sub: string; border: string }

const phaseLabel = (p: PendingAction['phase']): string => {
  switch (p) {
    case 'proving': return 'submitting…';
    case 'broadcasting': return 'broadcasting…';
    case 'scanning': return 'scanning into private balance…';
    default: return 'arriving…';
  }
};

/** A single muted pending-shield row. */
export function PendingShieldRow({ p, pal }: { p: PendingAction; pal: Pal }): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Row align="center" gap={12} py={14} style={{ borderBottomWidth: 1, borderBottomColor: border, opacity: 0.7 }}>
      <Box style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={16} color={sub} />
      </Box>
      <Col flex={1} style={{ minWidth: 0 }}>
        <Text weight="semibold" size="lg" style={{ color: head }} numberOfLines={1}>
          {p.symbol}
        </Text>
        <Text size="md" style={{ color: sub, marginTop: 2 }}>
          Pending shield · {phaseLabel(p.phase)}
        </Text>
      </Col>
      <Col align="end">
        <Text size="md" style={{ color: sub }}>
          +{p.delta} {p.symbol}
        </Text>
      </Col>
    </Row>
  );
}

/** Render the muted placeholder rows for every in-flight shield. Returns null
 *  when none. Sits at the TOP of the Tokens list so it's the first thing seen. */
export function PendingShieldRows({ pending, pal }: {
  pending: PendingAction[]; pal: Pal;
}): React.ReactElement | null {
  const live = pending.filter(
    p => p.kind === 'shield' && (p.phase === 'proving' || p.phase === 'broadcasting' || p.phase === 'scanning'),
  );
  if (!live.length) return null;
  return <>{live.map(p => <PendingShieldRow key={p.id} p={p} pal={pal} />)}</>;
}
