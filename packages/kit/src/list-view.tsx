/** ListView + ListViewItem - ChatKit-styled list primitives for the Metro
 *  mobile client.
 *
 *  Mirrors OpenAI ChatKit's `ListView` (container / WidgetRoot) and
 *  `ListViewItem` (WidgetNode) widget nodes. Real ChatKit props kept verbatim:
 *    - ListView: `children`, `limit`, `status`.
 *    - ListViewItem: `children`, `gap`, `align`.
 *  Deviations are the two the proposal calls out: a `dark` boolean (kit is
 *  hook-free) and `onPress` in place of ChatKit's server `onClickAction`.
 *
 *  ChatKit's `ListViewItem` is intentionally minimal: a clickable row wrapper
 *  with no title/subtitle/leading/trailing props. We mirror that faithfully -
 *  callers compose the row body from Row/Icon/Text (already in the kit), so this
 *  abstracts only the wrapper/pressed-bg/border/divider scaffolding, exactly as
 *  ChatKit does.
 *
 *  ListView draws 1px dividers BETWEEN items (not after the last one), honours
 *  `limit` (max rows shown), and renders an optional muted `status` line at the
 *  foot. Each ListViewItem owns its pressed-bg + horizontal padding so the row
 *  fill spans the full width while the divider stays inset. */

import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';

export type ListItemAlign = 'start' | 'center' | 'end';

const ALIGN: Record<ListItemAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

function palette(dark: boolean): { border: string; pressed: string; sub: string } {
  return dark
    ? { border: '#282a2d', pressed: '#1c1d1f', sub: '#7a7a7e' }
    : { border: '#e4e4e5', pressed: '#f2f2f3', sub: '#8a929d' };
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
        <View
          key={child.key ?? i}
          style={
            i < shown.length - 1
              ? { borderBottomWidth: 1, borderBottomColor: c.border }
              : undefined
          }
        >
          {child}
        </View>
      ))}
      {status ? (
        <RNText
          style={{
            color: c.sub,
            fontSize: 13,
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
    paddingHorizontal: 16,
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
