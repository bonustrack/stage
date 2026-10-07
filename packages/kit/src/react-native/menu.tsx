import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { kitPalette, type KitPalette } from '../tokens';
import { withAlpha } from '../badge';
import { OVERLAY_SHADOW } from '../overlay.styles';
import { Dialog } from './dialog';
import { Glyph, type CentralIcon } from './glyph';
import { MODAL } from './modal';
import { Text, type TextProps } from './text';
import { useKitPalette } from './theme-context';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';

export const DROPDOWN_MENU = {
  radius: 6,
  sheetRadius: 12,
  padY: 4,
  sheetPadY: 8,
  itemPadX: 16,
  itemPadY: 6,
  sheetItemPadY: 9,
  itemGap: 8,
  icon: 20,
  lineHeight: 24,
  sheetLineHeight: 26,
  separator: 1,
  separatorAlpha: 0.2,
  hoverAlpha: 0.08,
  pressedAlpha: 0.14,
} as const;

const SheetMenuContext = createContext(false);

export function useDropdownMenuText(): Pick<TextProps, 'size' | 'style'> {
  const sheet = useContext(SheetMenuContext);
  return {
    size: sheet ? 'lg' : 'sm',
    style: { lineHeight: sheet ? DROPDOWN_MENU.sheetLineHeight : DROPDOWN_MENU.lineHeight },
  };
}

function usePalette(dark: boolean | undefined): KitPalette {
  const context = useKitPalette();
  if (dark === undefined) return context;
  return kitPalette(dark ? 'dark' : 'light');
}

export interface DropdownMenuProps {
  children: ReactNode;
  dark?: boolean;
  background?: string;
  maxHeight?: number;
  style?: ViewStyle;
}

export function DropdownMenu({ children, dark, background, maxHeight, style }: DropdownMenuProps): React.ReactElement {
  const pal = usePalette(dark);
  const list = <View style={{ paddingVertical: DROPDOWN_MENU.padY }}>{children}</View>;
  return (
    <View
      style={[{
        alignSelf: 'flex-start',
        backgroundColor: background ?? pal.border,
        borderRadius: DROPDOWN_MENU.radius,
        overflow: 'hidden',
        ...OVERLAY_SHADOW,
      }, style]}
    >
      {maxHeight === undefined ? list : (
        <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>{list}</ScrollView>
      )}
    </View>
  );
}

export interface DropdownMenuItemProps {
  label: string;
  children?: ReactNode;
  onPress: () => void;
  iconName?: CentralIcon;
  icon?: ReactNode;
  danger?: boolean;
  dark?: boolean;
  color?: string;
  pressedBackground?: string;
  selected?: boolean;
  highlighted?: boolean;
}

export function DropdownMenuItem(props: DropdownMenuItemProps): React.ReactElement {
  const pal = usePalette(props.dark);
  const sheet = useContext(SheetMenuContext);
  const menuText = useDropdownMenuText();
  const [hovered, setHovered] = useState(false);
  const pressedBg = props.pressedBackground ?? withAlpha(pal.link, DROPDOWN_MENU.pressedAlpha);
  const hoverBg = withAlpha(pal.link, DROPDOWN_MENU.hoverAlpha);
  const color = props.color ?? (props.danger === true ? pal.danger : pal.link);
  const icon = props.icon ?? (props.iconName === undefined ? null : <Glyph icon={props.iconName} size={DROPDOWN_MENU.icon} color={color} />);
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={props.label}
      onHoverIn={() => { setHovered(true); }}
      onHoverOut={() => { setHovered(false); }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: DROPDOWN_MENU.itemGap,
        paddingHorizontal: DROPDOWN_MENU.itemPadX,
        paddingVertical: sheet ? DROPDOWN_MENU.sheetItemPadY : DROPDOWN_MENU.itemPadY,
        backgroundColor: pressed ? pressedBg : hovered || props.highlighted === true ? hoverBg : 'transparent',
      })}
    >
      {icon}
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        {props.children ?? <Text {...menuText} value={props.label} color={color} truncate />}
      </View>
      {props.selected === true ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={color} /> : null}
    </Pressable>
  );
}

export function DropdownMenuSeparator({ dark }: { dark?: boolean }): React.ReactElement {
  const pal = usePalette(dark);
  return <View style={{ height: DROPDOWN_MENU.separator, backgroundColor: withAlpha(pal.text, DROPDOWN_MENU.separatorAlpha) }} />;
}

export interface DropdownMenuSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: 'center' | 'bottom';
  dark?: boolean;
  background?: string;
  maxWidth?: number;
  avoidKeyboard?: boolean;
}

export function DropdownMenuSheet({ open, onClose, children, side = 'bottom', dark, background, maxWidth = MODAL.maxWidth, avoidKeyboard }: DropdownMenuSheetProps): React.ReactElement {
  const pal = usePalette(dark);
  const centered = side === 'center';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      side={side}
      animationType="none"
      gestureRoot
      avoidKeyboard={avoidKeyboard}
      backdropColor={MODAL.backdrop}
      panelBackground={background ?? pal.border}
      panelRadius={centered ? DROPDOWN_MENU.radius : DROPDOWN_MENU.sheetRadius}
      panelWidth={centered ? '100%' : undefined}
      panelMaxWidth={centered ? maxWidth : undefined}
      panelMaxHeight={MODAL.maxHeight}
      safeAreaBottom={!centered}
      scroll
      scrollPadding={{ y: centered ? DROPDOWN_MENU.padY : DROPDOWN_MENU.sheetPadY }}
    >
      <SheetMenuContext.Provider value={!centered}>{children}</SheetMenuContext.Provider>
    </Dialog>
  );
}
