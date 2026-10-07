import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { reactorsLabel } from '../conversation/reactors.model';
import { reactionPills } from './reactions.model';
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
      <Text value={emoji} size="3xs" />
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
  const pills = reactionPills(reactions, ownEmojis, pendingReactions, pendingRemovals);
  const confirmedPills = pills.filter(p => !p.pending);
  const pendingPills = pills.filter(p => p.pending);
  if (pills.length === 0) return null;

  return (
    <Row margin={{ top: 4 }} wrap gap={4}>
      {confirmedPills.length > 0 ? (
        <Row gap={4} wrap align="center">
          {confirmedPills.map(({ emoji, names, own }) => (
            <ReactionTooltip key={emoji} label={reactorsLabel(names)} emoji={emoji} onReact={onReact}>
              <ReactionPill
                emoji={emoji}
                count={names.length}
                own={own}
                pillBg={pillBg}
                ownBorderColor={link}
              />
            </ReactionTooltip>
          ))}
        </Row>
      ) : null}
      {pendingPills.map(({ emoji }) => (
        <Row padding={{ x: 8, y: 2 }} key={`pending-${emoji}`} align="center" gap={4} radius="full" background={pillBg} style={{
          opacity: 0.45,
        }}>
          <Text size="3xs">{emoji}</Text>
          <Text role="secondary" size="3xs">1</Text>
        </Row>
      ))}
    </Row>
  );
}
