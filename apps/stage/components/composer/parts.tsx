
import { useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';
import { mapCoordsOf } from '@stage-labs/client/embed/detect';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Image } from '@stage-labs/kit/react-native/image';
import { CallAwareVideo as VideoPlayer } from '../CallAwareVideo';
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
import { TEXT_11PX } from '../smallText';

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
          <Text size="lg" numberOfLines={1} style={{ flex: 1 }}>
            <Text size="lg" role="secondary">Replying to </Text>
            <Text size="lg" color={nameColor}>
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

const TRAY_TILE = 72;

function TileName({ name, fg }: { name: string; fg: string }): React.ReactElement {
  return (
    <Text color={fg} style={[TEXT_11PX, { width: TRAY_TILE, textAlign: 'center' }]} numberOfLines={1}>
      {name}
    </Text>
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

function TrayTile({
  at, fg, label, removeLabel, onRemove, children,
}: {
  at: Attachment; fg: string; label: string; removeLabel: string; onRemove: () => void; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Col width={TRAY_TILE} align="center" gap={4}>
      <Box size={TRAY_TILE} accessibilityLabel={label}>
        <Box size={TRAY_TILE} radius={8} surface="surface" style={{ overflow: 'hidden' }}>
          {children}
        </Box>
        <RemoveBadge label={removeLabel} onRemove={onRemove}/>
      </Box>
      <TileName name={at.name ?? at.id} fg={fg}/>
    </Col>
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
      <TrayTile at={image} fg={fg} label={`Image preview ${image.name ?? image.id}`} removeLabel="Remove image" onRemove={onRemove}>
        <Pressable
          onPress={() => { setOpen(true); }}
          pressedOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="View image"
        >
          <Image src={image.url} size={TRAY_TILE} fit="contain"/>
        </Pressable>
      </TrayTile>
      <ImageViewer uri={image.url} visible={open} onClose={() => { setOpen(false); }}/>
    </>
  );
}

function PendingVideo({
  video, fg, onRemove,
}: {
  video: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement {
  const { bg } = usePalette();
  return (
    <TrayTile at={video} fg={fg} label={`Video preview ${video.name ?? video.id}`} removeLabel="Remove video" onRemove={onRemove}>
      <VideoPlayer src={video.url} controls={false} background={bg} aspectRatio={1} fit="contain"/>
    </TrayTile>
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
    <TrayTile at={location} fg={fg} label="Location preview" removeLabel="Remove location" onRemove={onRemove}>
      <LocationTile lat={coords.lat} lng={coords.lng} size="sm"/>
    </TrayTile>
  );
}

function PendingFile({
  file, fg, onRemove,
}: {
  file: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement {
  return (
    <TrayTile at={file} fg={fg} label={`File preview ${file.name ?? file.id}`} removeLabel="Remove file" onRemove={onRemove}>
      <Box size={TRAY_TILE} align="center" justify="center">
        <Glyph icon={kindIcon(file.kind)} size={24} color={fg}/>
      </Box>
    </TrayTile>
  );
}

function PendingItem({
  at, fg, onRemove,
}: {
  at: Attachment; fg: string; onRemove: () => void;
}): React.ReactElement | null {
  if (at.kind === 'image') return <PendingImage image={at} fg={fg} onRemove={onRemove}/>;
  if (at.kind === 'video') return <PendingVideo video={at} fg={fg} onRemove={onRemove}/>;
  if (isLocation(at)) return <PendingLocation location={at} fg={fg} onRemove={onRemove}/>;
  return <PendingFile file={at} fg={fg} onRemove={onRemove}/>;
}

const TRAY_PADDING = { x: PAGE_GUTTER, top: 10, bottom: 6 };
const TRAY_SCROLL = { flexGrow: 0 };

export function PendingRow({
  fg, pending, onRemove,
}: {
  fg: string; pending: Attachment[]; onRemove: (index: number) => void;
}): React.ReactElement {
  const gesture = useMemo(() => Gesture.Native().disallowInterruption(true).shouldCancelWhenOutside(false), []);
  const tray = (
    <Scroll horizontal style={TRAY_SCROLL} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Row padding={TRAY_PADDING} gap={8}>
        {pending.map((a, i) => (
          <PendingItem key={a.id} at={a} fg={fg} onRemove={() => { onRemove(i); }}/>
        ))}
      </Row>
    </Scroll>
  );
  return Platform.OS === 'web' ? tray : <GestureDetector gesture={gesture}>{tray}</GestureDetector>;
}
