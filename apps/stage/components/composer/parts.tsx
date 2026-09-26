
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import { Avatar } from '../Avatar';
import { ImageViewer } from '../ImageViewer';
import { MENU_WIDTH } from '../AnchoredMenu';
import { Box, Row, Col, PAGE_GUTTER } from '../layout';
import { shortAddress } from '../../modules/messaging';
import { getPeerName } from '../../lib/peerProfiles';
import { type Attachment } from './types';
import { usePalette } from '../../lib/theme';
import { IconArrowUndoUp } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowUndoUp';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconImages1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImages1';
import { IconMicrophone } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconMicrophone';
import { IconPaperclip3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPaperclip3';

const kindIcon = (kind: string): CentralIcon => (
  kind === 'image' ? IconImages1 : kind === 'audio' ? IconMicrophone : IconPaperclip3
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
        <Row padding={{ y: 11, x: 0 }} align="center" gap={10}>
          <Glyph icon={IconArrowUndoUp} size={16} color={sub}/>
          <Text size="xl" numberOfLines={1} style={{ flex: 1 }}>
            <Text size="xl" role="secondary">Replying to </Text>
            <Text size="xl" color={nameColor}>
              {(sender ? getPeerName(sender) : undefined) ?? (sender ? shortAddress(sender) : 'message')}
            </Text>
          </Text>
          <Pressable onPress={onClear} hitSlop={8}>
            <Glyph icon={IconCrossMedium} size={18} color={sub}/>
          </Pressable>
        </Row>
      </Pressable>
    </Box>
  );
}

const keepInputFocus = Platform.OS === 'web'
  ? { onMouseDown: (event: { preventDefault: () => void }) => { event.preventDefault(); } }
  : {};

export function MentionMenu({ matches, active, onPick }: {
  matches: MentionCandidate[]; active: number; onPick: (candidate: MentionCandidate) => void;
}): React.ReactElement | null {
  if (matches.length === 0) return null;
  return (
    <Box margin={{ bottom: 8 }} style={{ position: 'absolute', bottom: '100%', left: PAGE_GUTTER, zIndex: 4 }} {...keepInputFocus}>
      <DropdownMenu style={{ width: MENU_WIDTH }}>
        {matches.map((c, i) => (
          <DropdownMenuItem
            key={c.address}
            label={c.name}
            highlighted={i === active}
            icon={<Avatar address={c.address} size={DROPDOWN_MENU.icon}/>}
            onPress={() => { onPick(c); }}
          />
        ))}
      </DropdownMenu>
    </Box>
  );
}

function PendingImage({
  image, fg, onRemove,
}: {
  image: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Col width={72} align="center" gap={4}>
        <Box>
          <Pressable
            onPress={() => { setOpen(true); }}
            pressedOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View image"
          >
            <Image src={image.url} size={72} radius={8} fit="cover"/>
          </Pressable>
          <Pressable
            onPress={onRemove}
            hitSlop={6}
            style={{
              position: 'absolute', top: -4, right: -4,
              backgroundColor: '#000', borderRadius: 999, padding: 2,
            }}
>
            <Glyph icon={IconCrossMedium} size={12} color="#ffffff"/>
          </Pressable>
        </Box>
        <Text size="3xs" color={fg} style={{ width: 72, textAlign: 'center' }} numberOfLines={1}>
          {image.name ?? image.id}
        </Text>
      </Col>
      <ImageViewer uri={image.url} visible={open} onClose={() => { setOpen(false); }}/>
    </>
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
          <PendingImage key={a.id} image={a} fg={fg} onRemove={() => { onRemove(i); }}/>
        ) : (
          <Row padding={{ x: 8, y: 4 }} key={a.id} align="center" gap={6} radius="lg" background={chipBg}>
            <Glyph icon={kindIcon(a.kind)} size={14} color={fg}/>
            <Text size="2xs" color={fg} style={{ maxWidth: 140 }} numberOfLines={1}>{a.name ?? a.id}</Text>
            <Pressable onPress={() => { onRemove(i); }} hitSlop={6}>
              <Glyph icon={IconCrossMedium} size={14} color={sub}/>
            </Pressable>
          </Row>
        )
      ))}
    </Row>
  );
}

