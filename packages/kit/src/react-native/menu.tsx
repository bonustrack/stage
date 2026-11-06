import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { withAlpha } from '../color-math';
import { OVERLAY_SHADOW } from '../overlay.styles';
import { Glyph, type CentralIcon } from './glyph';
import { Text, type TextProps } from './text';
import { useKitColors } from './theme-context';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { Dialog } from './dialog';
import { MODAL } from './modal';

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
  return { size: sheet ? 'lg' : 'sm', style: { lineHeight: sheet ? DROPDOWN_MENU.sheetLineHeight : DROPDOWN_MENU.lineHeight } };
}

export interface DropdownMenuProps {
  children: ReactNode;
  dark?: boolean;
  background?: string;
  maxHeight?: number;
  style?: ViewStyle;
}

export function DropdownMenu({ children, dark, background, maxHeight, style }: DropdownMenuProps): React.ReactElement {
  const pal = useKitColors(dark, 'provider').palette;
  const list = <View style={{ paddingVertical: DROPDOWN_MENU.padY }}>{children}</View>;
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: background ?? pal.border,
          borderRadius: DROPDOWN_MENU.radius,
          overflow: 'hidden',
          ...OVERLAY_SHADOW,
        },
        style,
      ]}
    >
      {maxHeight === undefined ? (
        list
      ) : (
        <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
          {list}
        </ScrollView>
      )}
    </View>
  );
}

export interface DropdownMenuItemProps extends Omit<PressableProps, 'children' | 'style' | 'onPress' | 'onHoverIn' | 'onHoverOut'> {
  label: string;
  children?: ReactNode;
  onPress: () => void;
  iconName?: CentralIcon;
  icon?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  danger?: boolean;
  dark?: boolean;
  color?: string;
  pressedBackground?: string;
  hoverBackground?: string;
  selected?: boolean;
  highlighted?: boolean;
  gap?: number;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}

interface ItemBox {
  sheet: boolean;
  gap: number | undefined;
  minHeight: number | undefined;
  disabled: boolean;
  background: string;
}

function itemBoxStyle({ sheet, gap, minHeight, disabled, background }: ItemBox): ViewStyle {
  const box: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gap ?? DROPDOWN_MENU.itemGap,
    paddingHorizontal: DROPDOWN_MENU.itemPadX,
    paddingVertical: sheet ? DROPDOWN_MENU.sheetItemPadY : DROPDOWN_MENU.itemPadY,
    backgroundColor: background,
  };
  if (minHeight !== undefined) box.minHeight = minHeight;
  if (disabled) box.opacity = DISABLED_OPACITY;
  return box;
}

const DISABLED_OPACITY = 0.5;

function itemLeading(leading: ReactNode, iconName: CentralIcon | undefined, color: string): ReactNode {
  return leading ?? (iconName === undefined ? null : <Glyph icon={iconName} size={DROPDOWN_MENU.icon} color={color} />);
}

function itemTrailing(trailing: ReactNode, selected: boolean | undefined, color: string): ReactNode {
  if (trailing !== undefined) return trailing;
  return selected === true ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={color} /> : null;
}

type ItemColorProps = Pick<DropdownMenuItemProps, 'dark' | 'color' | 'danger' | 'pressedBackground' | 'hoverBackground'>;

function useItemColors({ dark, color, danger, pressedBackground, hoverBackground }: ItemColorProps) {
  const pal = useKitColors(dark, 'provider').palette;
  return {
    color: color ?? (danger === true ? pal.danger : pal.link),
    pressed: pressedBackground ?? withAlpha(pal.link, DROPDOWN_MENU.pressedAlpha),
    hover: hoverBackground ?? withAlpha(pal.link, DROPDOWN_MENU.hoverAlpha),
  };
}

export function DropdownMenuItem(props: DropdownMenuItemProps): React.ReactElement {
  const {
    label,
    children,
    onPress,
    iconName,
    icon,
    leading,
    trailing,
    danger,
    dark,
    color,
    pressedBackground,
    hoverBackground,
    selected,
    highlighted,
    gap,
    minHeight,
    style,
    disabled,
    ...pressable
  } = props;
  const sheet = useContext(SheetMenuContext);
  const menuText = useDropdownMenuText();
  const [hovered, setHovered] = useState(false);
  const colors = useItemColors({ dark, color, danger, pressedBackground, hoverBackground });
  const off = disabled === true;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      {...pressable}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => {
        setHovered(true);
      }}
      onHoverOut={() => {
        setHovered(false);
      }}
      style={({ pressed }) => {
        const tinted = pressed ? colors.pressed : hovered || highlighted === true ? colors.hover : 'transparent';
        const box = itemBoxStyle({ sheet, gap, minHeight, disabled: off, background: off ? 'transparent' : tinted });
        return style === undefined ? box : [box, style];
      }}
    >
      {itemLeading(leading ?? icon, iconName, colors.color)}
      <View style={{ flexGrow: 1, flexShrink: 1 }}>{children ?? <Text {...menuText} text={label} color={colors.color} truncate />}</View>
      {itemTrailing(trailing, selected, colors.color)}
    </Pressable>
  );
}

export function DropdownMenuSeparator({ dark }: { dark?: boolean }): React.ReactElement {
  const pal = useKitColors(dark, 'provider').palette;
  const space = useContext(SheetMenuContext) ? DROPDOWN_MENU.sheetPadY : DROPDOWN_MENU.padY;
  return (
    <View
      style={{ height: DROPDOWN_MENU.separator, marginVertical: space, backgroundColor: withAlpha(pal.text, DROPDOWN_MENU.separatorAlpha) }}
    />
  );
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

export function DropdownMenuSheet({
  open,
  onClose,
  children,
  side = 'bottom',
  dark,
  background,
  maxWidth = MODAL.maxWidth,
  avoidKeyboard,
}: DropdownMenuSheetProps): React.ReactElement {
  const pal = useKitColors(dark, 'provider').palette;
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
