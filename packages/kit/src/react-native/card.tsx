import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Button } from './button';
import { Text, type TextSizeToken } from './text';
import { BLOCK_RADIUS_DEFAULT, schemePalette } from '../tokens';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { useKitScheme } from './theme-context';

export type CardSize = 'sm' | 'md' | 'lg';

export interface CardStatus {
  text: string;
  favicon?: string;
}

export interface CardAction {
  label: string;
  onPress: () => void;
}

export interface CardProps extends A2uiCommonProps {
  children?: ReactNode;
  size?: CardSize;
  padding?: number;
  background?: string;
  status?: CardStatus;
  collapsed?: boolean;
  confirm?: CardAction;
  cancel?: CardAction;
  onPress?: () => void;
  dark?: boolean;
  style?: ViewStyle;
}

const PADDING: Record<CardSize, number> = { sm: 10, md: 14, lg: 18 };
const STATUS_SIZE: Record<CardSize, TextSizeToken> = { sm: '3xs', md: '3xs', lg: '2xs' };

function CardFoot({ confirm, cancel, dark }: { confirm?: CardAction; cancel?: CardAction; dark: boolean }): React.ReactElement | null {
  if (!confirm && !cancel) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
      {cancel ? <Button color="secondary" variant="solid" size="sm" label={cancel.label} onPress={cancel.onPress} dark={dark} /> : null}
      {confirm ? <Button variant="primary" size="sm" label={confirm.label} onPress={confirm.onPress} dark={dark} /> : null}
    </View>
  );
}

function CardBody(props: CardProps & { sub: string; dark: boolean }): React.ReactElement {
  const { children, size = 'md', status, collapsed = false, confirm, cancel, dark, sub } = props;
  return (
    <>
      {status ? (
        <Text size={STATUS_SIZE[size]} color={sub} style={{ marginBottom: collapsed ? 0 : 8 }} numberOfLines={1}>
          {status.favicon ? `${status.favicon}  ` : ''}
          {status.text}
        </Text>
      ) : null}
      {collapsed ? null : children}
      <CardFoot confirm={confirm} cancel={cancel} dark={dark} />
    </>
  );
}

export function Card(props: CardProps): React.ReactElement {
  const scheme = useKitScheme();
  const { size = 'md', padding, background, onPress, dark = scheme === 'dark', style, weight, accessibility } = props;
  const c = schemePalette(dark);
  const body = <CardBody {...props} dark={dark} sub={c.sub} />;
  const base: ViewStyle = {
    backgroundColor: background ?? c.surface,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    overflow: 'hidden',
    padding: padding ?? PADDING[size],
    ...weightStyle(weight),
  };

  if (onPress) {
    return (
      <Pressable
        {...accessibilityProps(accessibility)}
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {body}
      </Pressable>
    );
  }

  return <View {...accessibilityProps(accessibility)} style={[base, style]}>{body}</View>;
}
