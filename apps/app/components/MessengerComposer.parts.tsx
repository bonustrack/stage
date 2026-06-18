/** Presentational fragments for the MessengerComposer (reply banner, @-mention
 *  popup, staged-attachment row, recording waveform bar), extracted for the lint
 *  line-budget. JSX + behavior identical — state owned by the parent. */

import { Animated, StyleSheet } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Avatar } from './Avatar';
import { Box, Row, Col } from './layout';
import { shortAddress } from '../modules/messaging';
import { getPeerName } from '../lib/peerProfiles';
import { type Attachment } from './MessengerComposer.helpers';
import { usePalette } from '../lib/theme';

const kindIcon = (kind: string): HeroIconName => (
  kind === 'image' ? 'photo' : kind === 'audio' ? 'microphone' : 'paperClip'
);

/** Renders the banner above the composer showing the message being replied to. */
export function ReplyBanner({
  dark, sub, sender, onClear, onPress,
}: {
  dark: boolean; sub: string; sender?: string | null;
  onClear?: () => void;
  /** Tap the banner body → scroll the feed to the replied-to message. */
  onPress?: () => void;
}): React.ReactElement {
  /** Username color: white in dark theme, the light brand blue otherwise (one-off,
   *  no matching token — leave hardcoded). */
  const nameColor = dark ? '#ffffff' : '#2f6feb';
  /** TopNav border value — matches the conversation header hairline exactly. */
  const borderColor = usePalette().border; // #282a2d / #e4e4e5
  return (
    /** The parent composer Col is already edge-to-edge (padding x:0), so the Box
     *  itself spans the full screen width — its `surface` bg and top hairline run
     *  edge-to-edge automatically. The px:22 here is a REAL inset (no negative
     *  margin breakout), pushing the content 22px in from each screen edge to line
     *  up with the composer input (Col padding 10 + Textarea `md` paddingHorizontal
     *  12 = 22px). Both the reply glyph (left) and the ✕ (right) sit at this 22px
     *  inset, symmetric. The bg uses the same `surface` token as the composer. */
    <Box padding={{ x: 22 }} surface="surface" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        {/** No extra inset → the outer Box px:22 alone supplies the full composer-
         *   matched inset on both sides. */}
        <Row padding={{ y: 11, x: 0 }} align="center" gap={10}>
          {/** Reply glyph leading the label (the swipe-to-reply icon). */}
          <Icon name="reply" size={16} color={sub}/>
          <Text size="xl" numberOfLines={1} style={{ flex: 1 }}>
            <Text size="xl" color={sub}>Replying to </Text>
            <Text size="xl" color={nameColor}>
              {(sender ? getPeerName(sender) : undefined) ?? (sender ? shortAddress(sender) : 'message')}
            </Text>
          </Text>
          {/** Plain ✕ on the right edge — no chip/circle bg, still tappable. */}
          <Pressable onPress={onClear} hitSlop={8}>
            <Icon name="x" size={18} color={sub}/>
          </Pressable>
        </Row>
      </Pressable>
    </Box>
  );
}

/** Renders the @-mention autocomplete popup of matching members above the composer. */
export function MentionPopup({
  dark, head, sub, matches, onPick,
}: {
  dark: boolean; head: string; sub: string;
  matches: { address: string; name: string; cacheBuster?: number }[];
  onPick: (c: { address: string; name: string }) => void;
}): React.ReactElement {
  const border = usePalette().border; // #282a2d / #e4e4e5
  return (
    <Col margin={{ x: 6, bottom: 8 }} radius="lg" background={dark ? '#1a1a1c' : '#ffffff'} style={{
      overflow: 'hidden',
      borderWidth: 1, borderColor: border,
    }}>
      {matches.map((c, i) => (
        <Pressable
          key={c.address}
          onPress={() => { onPick(c); }}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 12, paddingVertical: 8,
            backgroundColor: pressed ? border : 'transparent',
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
          })}
>
          <Avatar address={c.address} size="sm" cacheBuster={c.cacheBuster}/>
          <Text weight="semibold" size="md" color={head} style={{ flex: 1 }} numberOfLines={1}>
            {c.name}
          </Text>
          <Text size="2xs" color={sub} numberOfLines={1}>
            {shortAddress(c.address)}
          </Text>
        </Pressable>
      ))}
    </Col>
  );
}

/** Renders the row of staged (pending) attachment chips with remove buttons. */
export function PendingRow({
  fg, sub, chipBg, pending, onRemove,
}: {
  fg: string; sub: string; chipBg: string;
  pending: Attachment[]; onRemove: (index: number) => void;
}): React.ReactElement {
  return (
    <Row padding={{ x: 6, bottom: 6 }} wrap gap={8}>
      {pending.map((a, i) => (
        a.kind === 'image' ? (
          /** Image attachments: 72px square + filename label, x-to-remove pinned. */
          <Col width={72} key={a.id} align="center" gap={4}>
            <Box>
              <Image src={a.url} size={72} radius={8} fit="cover"/>
              <Pressable
                onPress={() => { onRemove(i); }}
                hitSlop={6}
                style={{
                  position: 'absolute', top: -4, right: -4,
                  backgroundColor: '#000', borderRadius: 999, padding: 2,
                }}
>
                <Icon name="x" size={12} color="#ffffff"/>
              </Pressable>
            </Box>
            <Text size="3xs" color={fg} style={{ width: 72, textAlign: 'center' }} numberOfLines={1}>
              {a.name ?? a.id}
            </Text>
          </Col>
        ) : (
          /** Non-image attachments keep the inline chip layout. */
          <Row padding={{ x: 8, y: 4 }} key={a.id} align="center" gap={6} radius="lg" background={chipBg}>
            <Icon name={kindIcon(a.kind)} size={14} color={fg}/>
            <Text size="2xs" color={fg} style={{ maxWidth: 140 }} numberOfLines={1}>{a.name ?? a.id}</Text>
            <Pressable onPress={() => { onRemove(i); }} hitSlop={6}>
              <Icon name="x" size={14} color={sub}/>
            </Pressable>
          </Row>
        )
      ))}
    </Row>
  );
}

/** Renders the active voice-recording bar with waveform levels, elapsed time, and slide-to-cancel. */
export function RecordingBar({
  head, sub, levels, recordSecs, slideX, slideThresholdPx,
}: {
  head: string; sub: string; levels: number[]; recordSecs: number;
  slideX: Animated.Value; slideThresholdPx: number;
}): React.ReactElement {
  return (
    <Row height={28} padding={{ x: 4 }} align="center">
      {/** "← Slide to cancel" hint — fades in as the user drags the mic left. */}
      <Animated.View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        transform: [{ translateX: slideX }],
        opacity: slideX.interpolate({
          inputRange: [-slideThresholdPx, -16, 0],
          outputRange: [1, 0.7, 0.4],
          extrapolate: 'clamp',
        }),
      }}>
        <Icon name="arrowLeft" size={14} color={sub}/>
        <Text size="xs" color={sub}>
          Slide to cancel
        </Text>
      </Animated.View>
      <Row height={28} flex={1} align="center" justify="end" style={{ overflow: 'hidden' }}>
        {[...Array(Math.max(0, 40 - levels.length)).fill(0.05), ...levels].slice(-40).map((lvl, i) => (
          <Box width={3} radius="2xs" height={Math.max(3, Math.round(lvl * 26))} background={head} margin={{ x: 1 }} key={i} style={{ opacity: 0.85 }}/>
        ))}
      </Row>
      <Text size="xs" color={sub} style={{ minWidth: 40, textAlign: 'center' }}>
        {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
      </Text>
    </Row>
  );
}
