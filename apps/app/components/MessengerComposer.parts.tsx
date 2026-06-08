/** Presentational fragments for the MessengerComposer (reply banner, @-mention
 *  popup, staged-attachment row, recording waveform bar), extracted for the lint
 *  line-budget. JSX + behavior identical — state owned by the parent. */

import { Animated, StyleSheet } from 'react-native';
import { fontSize } from '@metro-labs/kit/tokens';
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
    /** Outer container breaks out of the composer's `px={10}` with a -10 margin so
     *  the top border spans the full screen width edge-to-edge; the matching 10px
     *  paddingHorizontal keeps the inner content at its original inset. */
    <Box style={{
      marginHorizontal: -10, paddingHorizontal: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor,
    }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        {/** No extra left inset → the outer Box paddingHorizontal:10 alone places the
         *   ✕ at x≈10, flush with the composer's own left content edge (Col px:10),
         *   rather than the text glyph origin (x≈28). */}
        <Row align="center" gap={10} pl={0} pr={14} py={8}>
          <Pressable
            onPress={onClear}
            hitSlop={8}
            style={{
              width: 22, height: 22, borderRadius: 11,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#ffffff',
            }}
          >
            <Icon name="x" size={14} color="#000000" />
          </Pressable>
          <Text style={{ fontSize: fontSize('md'), fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
            <Text style={{ color: sub, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium' }}>Replying to </Text>
            <Text style={{ color: nameColor, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium' }}>
              {(sender ? getPeerName(sender) : undefined) ?? (sender ? shortAddress(sender) : 'message')}
            </Text>
          </Text>
        </Row>
      </Pressable>
    </Box>
  );
}

export function MentionPopup({
  dark, head, sub, matches, onPick,
}: {
  dark: boolean; head: string; sub: string;
  matches: { address: string; name: string; cacheBuster?: number }[];
  onPick: (c: { address: string; name: string }) => void;
}): React.ReactElement {
  const border = usePalette().border; // #282a2d / #e4e4e5
  return (
    <Col mx={6} mb={8} radius={12} bg={dark ? '#1a1a1c' : '#ffffff'} style={{
      overflow: 'hidden',
      borderWidth: 1, borderColor: border,
    }}>
      {matches.map((c, i) => (
        <Pressable
          key={c.address}
          onPress={() => onPick(c)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 12, paddingVertical: 8,
            backgroundColor: pressed ? border : 'transparent',
            borderTopWidth: i === 0 ? 0 : 1, borderTopColor: border,
          })}
        >
          <Avatar address={c.address} size="sm" cacheBuster={c.cacheBuster} />
          <Text style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
            {shortAddress(c.address)}
          </Text>
        </Pressable>
      ))}
    </Col>
  );
}

export function PendingRow({
  fg, sub, chipBg, pending, onRemove,
}: {
  fg: string; sub: string; chipBg: string;
  pending: Attachment[]; onRemove: (index: number) => void;
}): React.ReactElement {
  return (
    <Row wrap gap={8} px={6} pb={6}>
      {pending.map((a, i) => (
        a.kind === 'image' ? (
          /** Image attachments: 72px square + filename label, x-to-remove pinned. */
          <Col key={a.id} align="center" gap={4} style={{ width: 72 }}>
            <Box>
              <Image src={a.url} size={72} radius={8} fit="cover" />
              <Pressable
                onPress={() => onRemove(i)}
                hitSlop={6}
                style={{
                  position: 'absolute', top: -4, right: -4,
                  backgroundColor: '#000', borderRadius: 999, padding: 2,
                }}
              >
                <Icon name="x" size={12} color="#ffffff" />
              </Pressable>
            </Box>
            <Text style={{ color: fg, fontSize: fontSize('xs'), width: 72, textAlign: 'center' , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>
              {a.name ?? a.id}
            </Text>
          </Col>
        ) : (
          /** Non-image attachments keep the inline chip layout. */
          <Row key={a.id} align="center" gap={6} px={8} py={4} radius={12} bg={chipBg}>
            <Icon name={kindIcon(a.kind)} size={14} color={fg} />
            <Text style={{ color: fg, fontSize: fontSize('sm'), maxWidth: 140 , fontFamily: 'Calibre-Medium'}} numberOfLines={1}>{a.name ?? a.id}</Text>
            <Pressable onPress={() => onRemove(i)} hitSlop={6}>
              <Icon name="x" size={14} color={sub} />
            </Pressable>
          </Row>
        )
      ))}
    </Row>
  );
}

export function RecordingBar({
  head, sub, levels, recordSecs, slideX, slideThresholdPx,
}: {
  head: string; sub: string; levels: number[]; recordSecs: number;
  slideX: Animated.Value; slideThresholdPx: number;
}): React.ReactElement {
  return (
    <Row align="center" px={4} style={{ height: 28 }}>
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
        <Icon name="arrowLeft" size={14} color={sub} />
        <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }}>
          Slide to cancel
        </Text>
      </Animated.View>
      <Row flex={1} align="center" justify="end" style={{ height: 28, overflow: 'hidden' }}>
        {[...Array(Math.max(0, 40 - levels.length)).fill(0.05), ...levels].slice(-40).map((lvl, i) => (
          <Box key={i} style={{ width: 3, marginHorizontal: 1, borderRadius: 2, height: Math.max(3, Math.round(lvl * 26)), backgroundColor: head, opacity: 0.85 }} />
        ))}
      </Row>
      <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium', minWidth: 40, textAlign: 'center' }}>
        {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, '0')}
      </Text>
    </Row>
  );
}
