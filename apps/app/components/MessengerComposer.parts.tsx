
import { StyleSheet } from 'react-native';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
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
  onPress?: () => void;
}): React.ReactElement {
  const nameColor = dark ? '#ffffff' : '#2f6feb';
  const borderColor = usePalette().border;
  return (
    <Box padding={{ x: 22 }} surface="surface" style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }}>
      <Pressable onPress={onPress} disabled={!onPress}>
        {}
        <Row padding={{ y: 11, x: 0 }} align="center" gap={10}>
          {}
          <Icon name="reply" size={16} color={sub}/>
          <Text size="xl" numberOfLines={1} style={{ flex: 1 }}>
            <Text size="xl" role="secondary">Replying to </Text>
            <Text size="xl" color={nameColor}>
              {(sender ? getPeerName(sender) : undefined) ?? (sender ? shortAddress(sender) : 'message')}
            </Text>
          </Text>
          {}
          <Pressable onPress={onClear} hitSlop={8}>
            <Icon name="x" size={18} color={sub}/>
          </Pressable>
        </Row>
      </Pressable>
    </Box>
  );
}

export function MentionPopup({
  dark, head, matches, onPick,
}: {
  dark: boolean; head: string;
  matches: { address: string; name: string; cacheBuster?: number }[];
  onPick: (c: { address: string; name: string }) => void;
}): React.ReactElement {
  const border = usePalette().border;
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
          <Text size="2xs" role="secondary" numberOfLines={1}>
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
    <Row padding={{ x: 6, bottom: 6 }} wrap gap={8}>
      {pending.map((a, i) => (
        a.kind === 'image' ? (
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

