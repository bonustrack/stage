import type { ReactNode } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';

export function RailTooltip({ label, onPress, style, children }: {
  label: string;
  onPress: () => void;
  style: React.ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
  placement?: 'beside' | 'above' | 'below';
}): React.ReactElement {
  return <Pressable onPress={onPress} style={style} accessibilityLabel={label}>{children}</Pressable>;
}
