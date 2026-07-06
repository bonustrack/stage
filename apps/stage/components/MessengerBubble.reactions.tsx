
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Caption } from '@stage-labs/kit/react-native/caption';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

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
  reactions?: Map<string, number>;
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
          {confirmedEntries.map(([emoji, count]) => {
            const pill = (
              <ReactionPill
                key={emoji}
                emoji={emoji}
                count={count}
                own={!!ownEmojis?.has(emoji)}
                pillBg={pillBg}
                ownBorderColor={link}
              />
            );
            if (!onReact) return pill;
            return (
              <Pressable key={emoji} onPress={() => { onReact(emoji); }}>
                {pill}
              </Pressable>
            );
          })}
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

export function ReactionPicker({ dark, onPick, onClose }: {
  dark: boolean; onPick: (emoji: string) => void; onClose: () => void;
}): React.ReactElement {
  return (
    <Row padding={{ x: 10, y: 6 }} margin={{ top: 6 }} gap={8} radius="full" background={dark ? '#282a2d' : '#ffffff'} style={{
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
      alignSelf: 'flex-start',
    }}>
      {REACT_PRESETS.map(e => (
        <Pressable key={e} onPress={() => { onPick(e); }}>
          <Text size="5xl">{e}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onClose}>
        <Text size="lg" role="secondary" style={{ paddingHorizontal: 4 }}>✕</Text>
      </Pressable>
    </Row>
  );
}
