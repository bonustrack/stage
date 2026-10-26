import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { usePalette, withAlpha } from '../../lib/theme';
import type { SimulateResult, AssetMove } from '@stage-labs/client/wallet/txSimulate';
import { NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { useUsdValue } from '../../lib/txDisplay';
import { IconCircleCheck } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleCheck';
import { IconShieldBreak } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconShieldBreak';
import { IconSparklesThree } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSparklesThree';
import { Column, Row } from '../layout';

function SimOutcome({ sim, chainId }: {
  sim: SimulateResult; chainId: number;
}): React.ReactElement {
  const pal = usePalette();
  const fail = !sim.success;
  const { in: incoming, out } = sim.assetChanges;
  const noChange = incoming.length === 0 && out.length === 0;
  const accent = fail ? pal.danger : pal.success;
  const badge = fail ? `Will fail: ${sim.revertReason ?? 'transaction would revert'}` : 'Will succeed';
  return (
    <Column radius="md" padding={10} gap={8} background={withAlpha(accent, 0.1)}
      style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: accent }}>
      <Row align="center" gap={6}>
        <Glyph icon={fail ? IconShieldBreak : IconCircleCheck} size={14} color={accent} />
        <Text size="3xs" fontWeight="semibold" color={accent} numberOfLines={3}>{badge}</Text>
      </Row>
      {out.map((m, i) => <AssetMoveRow key={`o-${i}`} move={m} sign="-" color={pal.danger} label="You send" chainId={chainId} />)}
      {incoming.map((m, i) => <AssetMoveRow key={`i-${i}`} move={m} sign="+" color={pal.success} label="You receive" chainId={chainId} />)}
      {!fail && noChange ? <Text size="3xs" color="secondary">No balance changes</Text> : null}
    </Column>
  );
}

export function SimulationBlock({ sim, pending, sub, chainId }: {
  sim: SimulateResult | null; pending: boolean; sub: string; chainId: number;
}): React.ReactElement | null {
  if (pending) return <SimNote text="Simulating…" sub={sub} />;
  if (!sim) return null;
  if (sim.success === 'unknown') return <SimNote text="Could not simulate this transaction" sub={sub} />;
  return <SimOutcome sim={sim} chainId={chainId} />;
}

function SimNote({ text, sub }: { text: string; sub: string }): React.ReactElement {
  const { border } = usePalette();
  return (
    <Column radius="md" background={border} padding={10} gap={6} style={{ alignSelf: 'stretch' }}>
      <Row align="center" gap={6}>
        <Glyph icon={IconSparklesThree} size={14} color={sub} />
        <Text size="3xs" color="secondary">{text}</Text>
      </Row>
    </Column>
  );
}

function AssetMoveRow({ move, sign, color, label, chainId }: {
  move: AssetMove; sign: '+' | '-'; color: string; label: string; chainId: number;
}): React.ReactElement {
  const token = move.token.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase() ? null : move.token;
  const usd = useUsdValue(chainId, token, move.amount);
  return (
    <Row align="center" justify="spaceBetween" gap={8}>
      <Text size="3xs" color="secondary">{label}</Text>
      <Row align="center" gap={6} style={{ flexShrink: 1 }}>
        <Text size="2xs" fontWeight="semibold" color={color} numberOfLines={1}>
          {sign}{move.amount} {move.symbol}
        </Text>
        {usd ? <Text size="3xs" color="secondary" numberOfLines={1}>{usd}</Text> : null}
      </Row>
    </Row>
  );
}
