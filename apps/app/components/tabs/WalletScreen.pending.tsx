import { Text } from '@stage-labs/kit/react-native/text';

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

function PendingShieldRow({ p, pal }: { p: PendingAction; pal: Pal }): React.ReactElement {
  const { head, sub, border } = pal;
  return (
    <Row padding={{ y: 14 }} align="center" gap={12} style={{ borderBottomWidth: 1, borderBottomColor: border, opacity: 0.7 }}>
      <Box width={32} height={32} radius="full" background={border} align="center" justify="center">
        <Spinner size={16} color={sub}/>
      </Box>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="xl" color={head} numberOfLines={1}>
          {p.symbol}
        </Text>
        <Text size="md" color={sub} style={{ marginTop: 2 }}>
          Pending shield · {phaseLabel(p.phase)}
        </Text>
      </Col>
      <Col align="end">
        <Text size="md" color={sub}>
          +{p.delta} {p.symbol}
        </Text>
      </Col>
    </Row>
  );
}

export function PendingShieldRows({ pending, pal }: {
  pending: PendingAction[]; pal: Pal;
}): React.ReactElement | null {
  const live = pending.filter(
    p => p.kind === 'shield' && (p.phase === 'proving' || p.phase === 'broadcasting' || p.phase === 'scanning'),
  );
  if (!live.length) return null;
  return <>{live.map(p => <PendingShieldRow key={p.id} p={p} pal={pal} />)}</>;
}
