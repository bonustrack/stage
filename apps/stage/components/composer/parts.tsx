
import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';
import { mapCoordsOf } from '@stage-labs/client/embed/detect';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { VideoPlayer } from '@stage-labs/kit/react-native/video-player';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from '@stage-labs/kit/react-native/menu';
import { Avatar } from '../Avatar';
import { ImageViewer } from '../ImageViewer';
import { HoverTooltip } from '../HoverTooltip';
import { LocationTile } from '../MediaEmbeds';
import { MENU_WIDTH } from '../AnchoredMenu';
import { Box, Row, Col, PAGE_GUTTER } from '../layout';
import { shortAddress } from '../../modules/messaging';
import { getPeerName } from '../../lib/peerProfiles';
import { type Attachment } from './types';
import { isLocation } from './location.model';
import type { ChannelCandidate } from './channels.model';
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

export const keepInputFocus = Platform.OS === 'web'
  ? { onMouseDown: (event: { preventDefault: () => void }) => { event.preventDefault(); } }
  : {};

function SuggestionMenu({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box margin={{ bottom: 8 }} style={{ position: 'absolute', bottom: '100%', left: PAGE_GUTTER, zIndex: 4 }} {...keepInputFocus}>
      <DropdownMenu style={{ width: MENU_WIDTH }}>{children}</DropdownMenu>
    </Box>
  );
}

export function MentionMenu({ matches, active, onPick }: {
  matches: MentionCandidate[]; active: number; onPick: (candidate: MentionCandidate) => void;
}): React.ReactElement | null {
  if (matches.length === 0) return null;
  return (
    <SuggestionMenu>
      {matches.map((c, i) => (
        <DropdownMenuItem
          key={c.address}
          label={c.name}
          highlighted={i === active}
          icon={<Avatar address={c.address} size={DROPDOWN_MENU.icon}/>}
          onPress={() => { onPick(c); }}
        />
      ))}
    </SuggestionMenu>
  );
}

export function ChannelSuggestMenu({ matches, active, onPick }: {
  matches: ChannelCandidate[]; active: number; onPick: (candidate: ChannelCandidate) => void;
}): React.ReactElement | null {
  if (matches.length === 0) return null;
  return (
    <SuggestionMenu>
      {matches.map((c, i) => (
        <DropdownMenuItem
          key={c.convId}
          label={c.name}
          highlighted={i === active}
          icon={<Avatar address={c.avatarAddress} imageUri={c.avatarUri} square size={DROPDOWN_MENU.icon}/>}
          onPress={() => { onPick(c); }}
        />
      ))}
    </SuggestionMenu>
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
            <Image src={image.url} size={72} radius={8} fit="contain"/>
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

function RemoveBadge({ label, onRemove }: { label: string; onRemove: () => void }): React.ReactElement {
  return (
    <Box style={{ position: 'absolute', top: -4, right: -4 }}>
      <HoverTooltip label={label}>
        <Pressable
          onPress={onRemove}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{ backgroundColor: '#000', borderRadius: 999, padding: 2 }}
        >
          <Glyph icon={IconCrossMedium} size={12} color="#ffffff"/>
        </Pressable>
      </HoverTooltip>
    </Box>
  );
}

function PendingVideo({
  video, fg, onRemove,
}: {
  video: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement {
  return (
    <Col width={128} align="center" gap={4}>
      <Box width={128} accessibilityLabel={`Video preview ${video.name ?? video.id}`}>
        <VideoPlayer src={video.url} controls={false}/>
        <RemoveBadge label="Remove video" onRemove={onRemove}/>
      </Box>
      <Text size="3xs" color={fg} style={{ width: 128, textAlign: 'center' }} numberOfLines={1}>
        {video.name ?? video.id}
      </Text>
    </Col>
  );
}

function PendingLocation({
  location, fg, onRemove,
}: {
  location: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement | null {
  const coords = mapCoordsOf(location.url);
  if (!coords) return null;
  return (
    <Col width={72} align="center" gap={4}>
      <Box width={72} accessibilityLabel="Location preview">
        <Box radius={8} style={{ overflow: 'hidden' }}>
          <LocationTile lat={coords.lat} lng={coords.lng} pin="2xl"/>
        </Box>
        <RemoveBadge label="Remove location" onRemove={onRemove}/>
      </Box>
      <Text size="3xs" color={fg} style={{ width: 72, textAlign: 'center' }} numberOfLines={1}>
        {location.name ?? location.id}
      </Text>
    </Col>
  );
}

function PendingItem({
  at, fg, sub, chipBg, onRemove,
}: {
  at: Attachment; fg: string; sub: string; chipBg: string; onRemove: () => void;
}): React.ReactElement | null {
  if (at.kind === 'image') return <PendingImage image={at} fg={fg} onRemove={onRemove}/>;
  if (at.kind === 'video') return <PendingVideo video={at} fg={fg} onRemove={onRemove}/>;
  if (isLocation(at)) return <PendingLocation location={at} fg={fg} onRemove={onRemove}/>;
  return (
    <Row padding={{ x: 8, y: 4 }} align="center" gap={6} radius="lg" background={chipBg}>
      <Glyph icon={kindIcon(at.kind)} size={14} color={fg}/>
      <Text size="2xs" color={fg} style={{ maxWidth: 140 }} numberOfLines={1}>{at.name ?? at.id}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Glyph icon={IconCrossMedium} size={14} color={sub}/>
      </Pressable>
    </Row>
  );
}

export function PendingRow({
  fg, sub, chipBg, pending, onRemove,
}: {
  fg: string; sub: string; chipBg: string;
  pending: Attachment[]; onRemove: (index: number) => void;
}): React.ReactElement {
  return (
    <Row padding={{ x: PAGE_GUTTER, top: 10, bottom: 6 }} wrap gap={8}>
      {pending.map((a, i) => (
        <PendingItem key={a.id} at={a} fg={fg} sub={sub} chipBg={chipBg} onRemove={() => { onRemove(i); }}/>
      ))}
    </Row>
  );
}
