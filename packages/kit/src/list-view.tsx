/**
 * @file ListView + ListViewItem — hook-free ChatKit-styled list primitives with local `onPress`, inset dividers drawn only between items, and per-item pressed-bg fill.
 */

import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';
import { FONT_SIZE, schemePalette } from './tokens';

export type ListItemAlign = 'start' | 'center' | 'end';

/** Horizontal content inset shared by the row padding and the divider, so the divider starts where the row content (icon) starts and ends with equal spacing on the right. */
const ROW_INSET = 16;

const ALIGN: Record<ListItemAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

/** Palette helper. */
function palette(dark: boolean): { border: string; pressed: string; sub: string } {
  /** Pressed row fill = the hover surface in both schemes (#1c1d1f / #f2f2f3). */
  const p = schemePalette(dark);
  return { border: p.border, pressed: p.pressed, sub: p.sub };
}

export interface ListViewProps {
  /** ListViewItem children. */
  children: ReactNode;
  /** ChatKit: limit. Max rows shown (extra children are dropped). */
  limit?: number;
  /** ChatKit: status. Muted line at the foot of the list. */
  status?: { text: string };
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged onto the container last. */
  style?: ViewStyle;
}

/** ChatKit-style RN list container. Draws dividers between items. */
export function ListView(props: ListViewProps): React.ReactElement {
  const { children, limit, status, dark, style } = props;
  const c = palette(dark);

  const items = Children.toArray(children).filter(isValidElement);
  const shown = limit !== undefined ? items.slice(0, limit) : items;

  return (
    <View style={style}>
      {shown.map((child, i) => (
        <View key={child.key ?? i}>
          {child}
          {i < shown.length - 1 ? (
            <View
              style={{
                height: 1,
                backgroundColor: c.border,
                marginHorizontal: ROW_INSET,
              }}
            />
          ) : null}
        </View>
      ))}
      {status ? (
        <RNText
          style={{
            color: c.sub,
            fontSize: FONT_SIZE.xs,
            fontFamily: 'Calibre-Medium',
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
          numberOfLines={1}
        >
          {status.text}
        </RNText>
      ) : null}
    </View>
  );
}

export interface ListViewItemProps {
  /** Caller composes the row body from Row/Icon/Text. */
  children: ReactNode;
  /** RN form of ChatKit onClickAction. Omit for a non-pressable row. */
  onPress?: () => void;
  /** ChatKit: gap between children, px. Default 12. */
  gap?: number;
  /** ChatKit: align. Cross-axis alignment of children. Default 'center'. */
  align?: ListItemAlign;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged onto the row last. */
  style?: ViewStyle;
}

/** ChatKit-style RN list row. Clickable wrapper only; body is caller-composed. */
export function ListViewItem(props: ListViewItemProps): React.ReactElement {
  const { children, onPress, gap = 12, align = 'center', dark, style } = props;
  const c = palette(dark);

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: ALIGN[align],
    gap,
    paddingVertical: 16,
    paddingHorizontal: ROW_INSET,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          row,
          { backgroundColor: pressed ? c.pressed : 'transparent' },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[row, style]}>{children}</View>;
}
