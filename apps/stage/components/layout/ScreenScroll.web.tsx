import { View } from 'react-native';
import type { ScreenScrollProps } from './ScreenScroll.types';

export function ScreenScroll({ style, contentContainerStyle, children }: ScreenScrollProps): React.ReactElement {
  return (
    <View style={[{ flex: 1 }, style]}>
      <View style={[{ flexGrow: 1 }, contentContainerStyle]}>{children}</View>
    </View>
  );
}
