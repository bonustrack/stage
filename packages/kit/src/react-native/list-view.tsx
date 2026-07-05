
import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';
import { borderStyleEntries, type ResolvedBoxBorder } from '../layout';
import { FONT_SIZE, schemePalette } from '../tokens';

export type ListItemAlign = 'start' | 'center' | 'end';

const ROW_INSET = 16;

const ALIGN: Record<ListItemAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

function palette(dark: boolean): { border: string; pressed: string; sub: string } {
  const p = schemePalette(dark);
  return { border: p.border, pressed: p.pressed, sub: p.sub };
}

export interface ListViewProps {
  children: ReactNode;
  limit?: number;
  status?: { text: string };
  dark: boolean;
  style?: ViewStyle;
}

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
  children: ReactNode;
  onPress?: () => void;
  gap?: number;
  align?: ListItemAlign;
  dark: boolean;
  padding?: Record<string, string | number>;
  border?: ResolvedBoxBorder;
  pressedBackground?: string;
  pressedBorderColor?: string;
  showDivider?: boolean;
  style?: ViewStyle;
}

export function ListViewItem(props: ListViewItemProps): React.ReactElement {
  const {
    children,
    onPress,
    gap = 12,
    align = 'center',
    dark,
    padding,
    border,
    pressedBackground,
    pressedBorderColor,
    showDivider = false,
    style,
  } = props;
  const c = palette(dark);

  const borderStyle = border ? (borderStyleEntries(border) as ViewStyle) : undefined;
  const paddingStyle = (padding ?? {
    paddingTop: 16,
    paddingRight: ROW_INSET,
    paddingBottom: 16,
    paddingLeft: ROW_INSET,
  }) as ViewStyle;

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: ALIGN[align],
    gap,
  };

  const content = showDivider ? (
    <>
      {children}
      <View
        style={{
          position: 'absolute',
          left: ROW_INSET,
          right: ROW_INSET,
          bottom: 0,
          height: 1,
          backgroundColor: c.border,
        }}
      />
    </>
  ) : (
    children
  );

  if (onPress) {
    const pressedBg = pressedBackground ?? c.pressed;
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          row,
          paddingStyle,
          borderStyle,
          pressed
            ? pressedBorderColor !== undefined
              ? { borderColor: pressedBorderColor }
              : { backgroundColor: pressedBg }
            : undefined,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[row, paddingStyle, borderStyle, style]}>{content}</View>;
}
