/** Reaction pills row (confirmed + optimistic) and the preset reaction picker
 *  for MessengerBubble. Extracted to keep the component file under the lint cap. */

import { Pressable } from '@metro-labs/kit/pressable';

import { Text } from '@metro-labs/kit/text';
import { Row, Box } from './layout';
import { REACT_PRESETS } from './MessengerBubble.helpers';
import { usePalette } from '../lib/theme';

/** Confirmed + optimistic reaction pills. Returns null when there's nothing to
 *  show. Tapping/long-pressing any pill toggles that emoji as the user's own. */
export function ReactionsRow({
  reactions, pendingReactions, pendingRemovals, ownEmojis, sub, pillBg, onReact,
}: {
  reactions?: Map<string, number>;
  pendingReactions?: string[];
  pendingRemovals?: string[];
  ownEmojis?: Set<string>;
  sub: string; pillBg: string;
  onReact?: (emoji: string) => void;
}): React.ReactElement | null {
  const { link } = usePalette();
  /** Only show a pending pill for an emoji the live stream hasn't yet confirmed —
   *  guards the in-between frame so we never render confirmed + pending together. */
  const pendingEmojis = (pendingReactions ?? []).filter(e => !reactions?.has(e));
  /** Drop optimistically-removed emojis so the pill vanishes before the echo. */
  const removed = new Set(pendingRemovals ?? []);
  const confirmedEntries = reactions
    ? [...reactions.entries()].filter(([emoji]) => !removed.has(emoji))
    : [];
  const hasConfirmed = confirmedEntries.length > 0;
  if (!hasConfirmed && pendingEmojis.length === 0) return null;
  return (
    <Row wrap gap={4} mt={4}>
      {confirmedEntries.map(([emoji, count]) => {
        /** Own pills get a subtle outline; tap toggles add/remove via onReact. */
        const mine = !!ownEmojis?.has(emoji);
        const inner = (
          <>
            <Text size="xs">{emoji}</Text>
            <Text size="3xs" color={sub}>{count}</Text>
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
            onPress={() => onReact(emoji)}
            onLongPress={() => onReact(emoji)}
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
        <Row key={`pending-${emoji}`} align="center" gap={4} px={8} py={2} radius={999} bg={pillBg} style={{
          opacity: 0.45,
        }}>
          <Text size="xs">{emoji}</Text>
          <Text size="3xs" color={sub}>1</Text>
        </Row>
      ))}
    </Row>
  );
}

/** Preset emoji picker strip with a dismiss affordance. */
export function ReactionPicker({ dark, sub, onPick, onClose }: {
  dark: boolean; sub: string; onPick: (emoji: string) => void; onClose: () => void;
}): React.ReactElement {
  return (
    <Row gap={8} mt={6} px={10} py={6} radius={999} bg={dark ? '#282a2d' : '#ffffff'} style={{
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
      alignSelf: 'flex-start',
    }}>
      {REACT_PRESETS.map(e => (
        <Pressable key={e} onPress={() => onPick(e)}>
          <Text size="5xl">{e}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onClose}>
        <Text size="lg" color={sub} style={{ paddingHorizontal: 4 }}>✕</Text>
      </Pressable>
    </Row>
  );
}
