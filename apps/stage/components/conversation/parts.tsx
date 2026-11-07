import { Dimensions, useWindowDimensions } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { DROPDOWN_MENU, DropdownMenu } from '@stage-labs/kit/react-native/menu';
import { Text } from '@stage-labs/kit/react-native/text';
import { TOPNAV_HEIGHT, TopnavFade } from '../Topnav';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ConvAvatar, type ConvAvatarProps } from '../ConvAvatar';
import { REACT_PRESETS } from '../bubble/reactions.model';
import { offersSelectMode } from '../bubble/interaction';
import { usePalette } from '../../lib/theme';
import { useWebTabRail } from '../layout/webLayout';
import type { HistoryEntry } from '@stage-labs/client/types';
import { menuPlacement, STRIP_GAP, MENU_STRIP_HEIGHT } from './menuPlacement';
import { bubbleMenuItems } from './bubbleMenu.model';
import { AnchoredOverlay, MENU_WIDTH, useAnchoredMenus } from '../AnchoredMenu';
import { OVERLAY_SHADOW } from '@stage-labs/kit/overlay.styles';
import { MenuRow } from '../MenuRows';
import { anchoredMenuStyle, type MenuPoint } from '../AnchoredMenu.model';
import type { MenuAnchor } from '../bubble/model';
import { useHover } from '../hover';
import { IconArrowLeft } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowLeft';
import { TitleText } from '../TitleText';
import type { ConvTitle } from '../../lib/convIdentity';
import { MODAL, Overlay } from '@stage-labs/kit/react-native/modal';
import { Column, Row, pinnedTop, PAGE_GUTTER } from '../layout';

export function ConvTopnavShell({
  fg,
  border,
  safeTop,
  onBack,
  children,
}: {
  fg: string;
  border: string;
  safeTop: number;
  onBack: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { link } = usePalette();
  const back = useHover();
  const wide = useWebTabRail();
  return (
    <Column style={pinnedTop(2)}>
      <Row
        height={TOPNAV_HEIGHT + safeTop}
        surface="toolbar"
        padding={{ top: safeTop, left: wide ? PAGE_GUTTER : 0 }}
        align="stretch"
        style={wide ? { borderBottomWidth: 1, borderBottomColor: border } : undefined}
      >
        {!wide ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            {...back.hoverProps}
            style={{ paddingLeft: PAGE_GUTTER, paddingRight: 8, justifyContent: 'center' }}
          >
            <Glyph icon={IconArrowLeft} size={24} color={back.hovered ? link : fg} />
          </Pressable>
        ) : null}
        {children}
      </Row>
      {wide ? null : <TopnavFade top={TOPNAV_HEIGHT + safeTop} />}
    </Column>
  );
}

export function ConvTopnavIdentity({
  head,
  title,
  onPress,
  ...avatar
}: ConvAvatarProps & { head: string; title: ConvTitle; onPress?: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
    >
      <ConvAvatar {...avatar} size="sm" />
      <TitleText
        title={title}
        fontWeight={avatar.isGroup ? 'medium' : 'semibold'}
        size="xl"
        color={head}
        style={{ flex: 1 }}
        numberOfLines={1}
      />
    </Pressable>
  );
}

function ReactionStrip({ stripBg, onReact }: { stripBg: string; onReact: (e: string) => void }): React.ReactElement {
  return (
    <Row
      background={stripBg}
      radius="full"
      padding={{ x: 10, y: 6 }}
      align="center"
      gap={4}
      style={{ alignSelf: 'flex-start', ...OVERLAY_SHADOW }}
    >
      {REACT_PRESETS.map((e) => (
        <Pressable
          key={e}
          onPress={() => {
            onReact(e);
          }}
          hitSlop={4}
          style={{ paddingHorizontal: 2 }}
        >
          <Text size="2xl">{e}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

const ACTION_ROW_HEIGHT = 2 * DROPDOWN_MENU.itemPadY + DROPDOWN_MENU.lineHeight;

function AnchoredBubbleMenu({
  open,
  point,
  onClose,
  strip,
  dropdown,
}: {
  open: boolean;
  point: MenuPoint;
  onClose: () => void;
  strip: React.ReactNode;
  dropdown: React.ReactNode;
}): React.ReactElement {
  const viewport = useWindowDimensions();
  const placement = anchoredMenuStyle(point, viewport);
  return (
    <AnchoredOverlay open={open} onClose={onClose}>
      <Column
        width={MENU_WIDTH}
        align="start"
        pointerEvents="box-none"
        style={{ position: 'absolute', top: placement.top, bottom: placement.bottom, left: placement.left, right: placement.right }}
      >
        {strip}
        <Column height={STRIP_GAP} pointerEvents="none" />
        {dropdown}
      </Column>
    </AnchoredOverlay>
  );
}

export function BubbleActionMenu(p: {
  target: HistoryEntry | null;
  anchor: MenuAnchor;
  canDelete: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onSelect: () => void;
  onAddToDashboard?: () => void;
  onShareLink: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const { target, anchor, onClose } = p;
  const anchored = useAnchoredMenus();

  const pal = usePalette();
  const windowHeight = Dimensions.get('window').height;
  const items = bubbleMenuItems(!!target?.text, {
    selectText: offersSelectMode,
    canDelete: p.canDelete,
    addToDashboard: p.onAddToDashboard !== undefined,
  });
  const dropdownHeight = items.length * ACTION_ROW_HEIGHT + 2 * DROPDOWN_MENU.padY;
  const { stripTop, dropdownAbove } = menuPlacement(anchor.y, dropdownHeight, windowHeight);
  const reactAndClose = (e: string): void => {
    p.onReact(e);
    onClose();
  };
  const on = {
    reply: p.onReply,
    copy: p.onCopy,
    select: p.onSelect,
    addToDashboard: p.onAddToDashboard ?? onClose,
    shareLink: p.onShareLink,
    delete: p.onDelete,
  };

  const dropdown = (
    <DropdownMenu>
      {items.map((item) => (
        <MenuRow key={item.id} icon={item.icon} label={item.label} danger={item.danger} onPress={on[item.id]} />
      ))}
    </DropdownMenu>
  );
  const strip = <ReactionStrip stripBg={pal.border} onReact={reactAndClose} />;

  if (anchored && anchor.point) {
    return <AnchoredBubbleMenu open={!!target} point={anchor.point} onClose={onClose} strip={strip} dropdown={dropdown} />;
  }

  return (
    <Overlay open={!!target} onClose={onClose} animationType="none" backdropColor={MODAL.backdrop}>
      <Column
        align="start"
        pointerEvents="box-none"
        style={
          dropdownAbove
            ? { position: 'absolute', left: 12, right: 12, bottom: windowHeight - stripTop + STRIP_GAP }
            : { position: 'absolute', left: 12, right: 12, top: stripTop + MENU_STRIP_HEIGHT + STRIP_GAP }
        }
      >
        {dropdownAbove ? dropdown : null}
      </Column>
      <Column align="start" style={{ position: 'absolute', left: 12, right: 12, top: stripTop }} pointerEvents="box-none">
        {strip}
        {dropdownAbove ? null : (
          <>
            <Column height={STRIP_GAP} pointerEvents="none" />
            {dropdown}
          </>
        )}
      </Column>
    </Overlay>
  );
}
