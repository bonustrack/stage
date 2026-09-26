import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { reactorsLabel } from '../conversation/reactors.model';
import { ReactionTooltip } from './ReactionTooltip';

function ReactionPill({ emoji, count, own, pillBg, ownBorderColor }: {
  emoji: string; count: number; own: boolean; pillBg: string; ownBorderColor: string;
}): React.ReactElement {
  return (
    <Row
      align="center"
      gap={4}
      padding={{ x: 8, y: 2 }}
      radius="full"
      background={pillBg}
    >
      <Text value={emoji} size="xs" />
      <Caption value={String(count)} color="secondary" />
      {own ? (
        <Box
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -1,
            left: -1,
            right: -1,
            bottom: -1,
            borderWidth: 1,
            borderColor: ownBorderColor,
            borderRadius: 9999,
          }}
        />
      ) : null}
    </Row>
  );
}

export function ReactionsRow({
  reactions, pendingReactions, pendingRemovals, ownEmojis, pillBg, onReact,
}: {
  reactions?: Map<string, string[]>;
  pendingReactions?: string[];
  pendingRemovals?: string[];
  ownEmojis?: Set<string>;
  pillBg: string;
  onReact?: (emoji: string) => void;
}): React.ReactElement | null {
  const { link } = usePalette();
  const pendingEmojis = (pendingReactions ?? []).filter(e => !reactions?.has(e));
  const removed = new Set(pendingRemovals ?? []);
  const confirmedEntries = reactions
    ? [...reactions.entries()].filter(([emoji]) => !removed.has(emoji))
    : [];
  const hasConfirmed = confirmedEntries.length> 0;
  if (!hasConfirmed && pendingEmojis.length === 0) return null;

  return (
    <Row margin={{ top: 4 }} wrap gap={4}>
      {hasConfirmed ? (
        <Row gap={4} wrap align="center">
          {confirmedEntries.map(([emoji, names]) => (
            <ReactionTooltip key={emoji} label={reactorsLabel(names)} emoji={emoji} onReact={onReact}>
              <ReactionPill
                emoji={emoji}
                count={names.length}
                own={!!ownEmojis?.has(emoji)}
                pillBg={pillBg}
                ownBorderColor={link}
              />
            </ReactionTooltip>
          ))}
        </Row>
      ) : null}
      {pendingEmojis.map(emoji => (
        <Row padding={{ x: 8, y: 2 }} key={`pending-${emoji}`} align="center" gap={4} radius="full" background={pillBg} style={{
          opacity: 0.45,
        }}>
          <Text size="xs">{emoji}</Text>
          <Text size="3xs" role="secondary">1</Text>
        </Row>
      ))}
    </Row>
  );
}
