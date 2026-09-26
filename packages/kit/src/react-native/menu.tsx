import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { kitPalette, type KitPalette } from '../tokens';
import { withAlpha } from '../badge';
import { OVERLAY_SHADOW } from '../overlay.styles';
import { Glyph, type CentralIcon } from './glyph';
import { Text } from './text';
import { useKitPalette } from './theme-context';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';

export const DROPDOWN_MENU = {
  radius: 6,
  padY: 4,
  itemPadX: 16,
  itemPadY: 6,
  itemGap: 8,
  icon: 20,
  lineHeight: 24,
  separator: 1,
  separatorAlpha: 0.2,
  hoverAlpha: 0.08,
  pressedAlpha: 0.14,
} as const;

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
  onPress: () => void;
  iconName?: CentralIcon;
  icon?: ReactNode;
  danger?: boolean;
  dark?: boolean;
  color?: string;
  pressedBackground?: string;
  selected?: boolean;
}

export function DropdownMenuItem(props: DropdownMenuItemProps): React.ReactElement {
  const pal = usePalette(props.dark);
  const [hovered, setHovered] = useState(false);
  const pressedBg = props.pressedBackground ?? withAlpha(pal.link, DROPDOWN_MENU.pressedAlpha);
  const hoverBg = withAlpha(pal.link, DROPDOWN_MENU.hoverAlpha);
  const color = props.color ?? (props.danger === true ? pal.danger : pal.link);
  const icon = props.icon ?? (props.iconName === undefined ? null : <Glyph icon={props.iconName} size={DROPDOWN_MENU.icon} color={color} />);
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="menuitem"
      onHoverIn={() => { setHovered(true); }}
      onHoverOut={() => { setHovered(false); }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: DROPDOWN_MENU.itemGap,
        paddingHorizontal: DROPDOWN_MENU.itemPadX,
        paddingVertical: DROPDOWN_MENU.itemPadY,
        backgroundColor: pressed ? pressedBg : hovered ? hoverBg : 'transparent',
      })}
    >
      {icon}
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text value={props.label} size="xl" color={color} truncate style={{ lineHeight: DROPDOWN_MENU.lineHeight }} />
      </View>
      {props.selected === true ? <Glyph icon={IconCheckmark1} size={DROPDOWN_MENU.icon} color={color} /> : null}
    </Pressable>
  );
}

export function DropdownMenuSeparator({ dark }: { dark?: boolean }): React.ReactElement {
  const pal = usePalette(dark);
  return <View style={{ height: DROPDOWN_MENU.separator, backgroundColor: withAlpha(pal.text, DROPDOWN_MENU.separatorAlpha) }} />;
}
