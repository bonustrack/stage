
import { Pressable } from '@stage-labs/kit/react-native/pressable';

import { Text } from '@stage-labs/kit/react-native/text';
import { Row, Box } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

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
      {confirmedEntries.map(([emoji, count]) => {
        const mine = !!ownEmojis?.has(emoji);
        const inner = (
          <>
            <Text size="xs">{emoji}</Text>
            <Text size="3xs" role="secondary">{count}</Text>
          </>
        );
        const pillStyle = {
          flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
          paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: pillBg,
          borderWidth: mine ? 1 : 0,
          borderColor: mine ? link : 'transparent',
        };
        return onReact ? (
          <Pressable
            key={emoji}
            onPress={() => { onReact(emoji); }}
            onLongPress={() => { onReact(emoji); }}
            delayLongPress={300}
            hitSlop={6}
            style={pillStyle}
>
            {inner}
          </Pressable>
        ) : (
          <Box key={emoji} style={pillStyle}>{inner}</Box>
        );
      })}
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
