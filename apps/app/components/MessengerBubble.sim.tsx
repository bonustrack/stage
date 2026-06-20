/** @file SimulationBlock — pre-sign eth_simulateV1 dry-run view for a tx-request card, showing a SUCCESS/FAIL badge and predicted asset movement (loud on a predicted revert) without ever hard-blocking signing. */

import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
import { Row, Col, Box } from './layout';
import { usePalette, withAlpha } from '../lib/theme';
import type { SimulateResult, AssetMove } from '../lib/txSimulate';
import { NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { useUsdValue } from '../lib/txPrices';

/** Renders the resolved (success/fail) simulation outcome: badge + predicted asset movements. */
function SimOutcome({ sim, sub, chainId }: {
  sim: SimulateResult; sub: string; chainId: number;
}): React.ReactElement {
  const pal = usePalette();
  const fail = !sim.success;
  const { in: incoming, out } = sim.assetChanges;
  const noChange = incoming.length === 0 && out.length === 0;
  /** FAIL gets the red danger frame (loud); SUCCESS a calm success-tinted box. */
  const accent = fail ? pal.danger : pal.success;
  const badge = fail ? `Will fail: ${sim.revertReason ?? 'transaction would revert'}` : 'Will succeed';
  return (
    <Box radius="md" padding={10} gap={8} background={withAlpha(accent, 0.1)}
      style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: accent }}>
      <Row align="center" gap={6}>
        <Icon name={fail ? 'shieldExclamation' : 'checkCircle'} size={14} color={accent} />
        <Text size="xs" weight="semibold" color={accent} numberOfLines={3}>{badge}</Text>
      </Row>
      {out.map((m, i) => <AssetMoveRow key={`o-${i}`} move={m} sign="-" color={pal.danger} label="You send" sub={sub} chainId={chainId} />)}
      {incoming.map((m, i) => <AssetMoveRow key={`i-${i}`} move={m} sign="+" color={pal.success} label="You receive" sub={sub} chainId={chainId} />)}
      {!fail && noChange ? <Text size="xs" color={sub}>No balance changes</Text> : null}
    </Box>
  );
}

/** Renders the pre-sign transaction simulation result (success/fail badge and predicted asset movements). */
export function SimulationBlock({ sim, pending, sub, chainId }: {
  sim: SimulateResult | null; pending: boolean; sub: string; chainId: number;
}): React.ReactElement | null {
  const pal = usePalette();
  if (pending) return <SimNote text="Simulating…" sub={sub} bg={pal.border} />;
  if (!sim) return null;
  /** Could-not-simulate: calm, informative — the rest of the card still works. */
  if (sim.success === 'unknown') {
    return <SimNote text="Could not simulate this transaction" sub={sub} bg={pal.border} />;
  }
  return <SimOutcome sim={sim} sub={sub} chainId={chainId} />;
}

/** A neutral one-line note box (pending / could-not-simulate states). */
function SimNote({ text, sub, bg }: { text: string; sub: string; bg: string }): React.ReactElement {
  return (
    <Col radius="md" background={bg} padding={10} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={6}>
        <Icon name="sparkles" size={14} color={sub} />
        <Text size="xs" color={sub}>{text}</Text>
      </Row>
    </Col>
  );
}

/** One asset line: a labelled signed amount + symbol, with a `~$X` USD suffix when the token has a known price (amount only otherwise — never a fake $). */
function AssetMoveRow({ move, sign, color, label, sub, chainId }: {
  move: AssetMove; sign: '+' | '-'; color: string; label: string; sub: string; chainId: number;
}): React.ReactElement {
  const token = move.token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase() ? null : move.token;
  const usd = useUsdValue(chainId, token, move.amount);
  return (
    <Row align="center" justify="between" gap={8}>
      <Text size="xs" color={sub}>{label}</Text>
      <Row align="center" gap={6} style={{ flexShrink: 1 }}>
        <Text size="sm" weight="semibold" color={color} numberOfLines={1}>
          {sign}{move.amount} {move.symbol}
        </Text>
        {usd ? <Text size="xs" color={sub} numberOfLines={1}>{usd}</Text> : null}
      </Row>
    </Row>
  );
}
