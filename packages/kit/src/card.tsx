/**
 * @file Card — a hook-free ChatKit-styled bordered surface for the Metro mobile client, with a local `onPress` and a `collapsed` mode that hides the body.
 */

import { type ReactNode } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';
import { Button } from './button';
import { BLOCK_RADIUS_DEFAULT, FONT_SIZE, schemePalette } from './tokens';

export type CardSize = 'sm' | 'md' | 'lg';

export interface CardStatus {
  /** Status line text shown above the body. ChatKit: status. */
  text: string;
  /** Optional favicon/emoji rendered before the status text. */
  favicon?: string;
}

export interface CardAction {
  label: string;
  onPress: () => void;
}

export interface CardProps {
  children?: ReactNode;
  /** ChatKit: size. Controls padding + status font. Default 'md'. */
  size?: CardSize;
  /** ChatKit: padding. Overrides the size-derived padding (px). */
  padding?: number;
  /** ChatKit: background. Token/hex; falls back to the scheme surface. */
  background?: string;
  /** ChatKit: status. Muted line above the body. */
  status?: CardStatus;
  /** ChatKit: collapsed. Hides the body, keeps status + actions. */
  collapsed?: boolean;
  /** ChatKit: asForm. Semantic hint (passthrough on RN). */
  asForm?: boolean;
  /** ChatKit: confirm. Primary action in the foot row. */
  confirm?: CardAction;
  /** ChatKit: cancel. Secondary action in the foot row. */
  cancel?: CardAction;
  /** RN form of ChatKit onClickAction. Makes the whole card pressable. */
  onPress?: () => void;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged onto the container last. */
  style?: ViewStyle;
}

const PADDING: Record<CardSize, number> = { sm: 10, md: 14, lg: 18 };
const STATUS_SIZE: Record<CardSize, number> = {
  sm: FONT_SIZE['2xs'],
  md: FONT_SIZE.xs,
  lg: FONT_SIZE.sm,
};

/** Palette helper. */
function palette(dark: boolean): { surface: string; border: string; sub: string } {
  const p = schemePalette(dark);
  return { surface: p.surface, border: p.border, sub: p.sub };
}

/** ChatKit-style RN card. */
export function Card(props: CardProps): React.ReactElement {
  const {
    children,
    size = 'md',
    padding,
    background,
    status,
    collapsed = false,
    confirm,
    cancel,
    onPress,
    dark,
    style,
  } = props;

  const c = palette(dark);
  const pad = padding ?? PADDING[size];

  const body = (
    <>
      {status ? (
        <RNText
          style={{
            color: c.sub,
            fontSize: STATUS_SIZE[size],
            fontFamily: 'Calibre-Medium',
            marginBottom: collapsed ? 0 : 8,
          }}
          numberOfLines={1}
        >
          {status.favicon ? `${status.favicon}  ` : ''}
          {status.text}
        </RNText>
      ) : null}

      {collapsed ? null : children}

      {confirm || cancel ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 12,
          }}
        >
          {cancel ? (
            <Button
              variant="secondary"
              size="sm"
              label={cancel.label}
              onPress={cancel.onPress}
              dark={dark}
            />
          ) : null}
          {confirm ? (
            <Button
              variant="primary"
              size="sm"
              label={confirm.label}
              onPress={confirm.onPress}
              dark={dark}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );

  const base: ViewStyle = {
    backgroundColor: background ?? c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    padding: pad,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{body}</View>;
}
