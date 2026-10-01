import { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import type { ScreenScrollHandle, ScreenScrollProps } from './ScreenScroll.types';

export const ScreenScroll = forwardRef<ScreenScrollHandle, ScreenScrollProps>(function ScreenScroll({ style, contentContainerStyle, children }, ref): React.ReactElement {
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({ offset, animated }) => { window.scrollTo({ top: offset, behavior: animated === true ? 'smooth' : 'instant' }); },
  }), []);
  return (
    <View style={[{ flex: 1 }, style]}>
      <View style={[{ flexGrow: 1 }, contentContainerStyle]}>{children}</View>
    </View>
  );
});
