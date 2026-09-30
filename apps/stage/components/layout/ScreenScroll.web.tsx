import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { SELF_SCROLL, SELF_SCROLLBAR } from './webChrome';
import type { ScreenScrollHandle, ScreenScrollProps } from './ScreenScroll.types';

export const ScreenScroll = forwardRef<ScreenScrollHandle, ScreenScrollProps>(function ScreenScroll({ style, contentContainerStyle, children, scroll }, ref): React.ReactElement {
  const root = useRef<View>(null);
  const self = scroll === 'self';
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({ offset, animated }) => {
      const host = self ? (root.current as unknown as HTMLElement | null) : window;
      host?.scrollTo({ top: offset, behavior: animated === true ? 'smooth' : 'instant' });
    },
  }), [self]);
  return (
    <View ref={root} style={[{ flex: 1 }, style, self ? SELF_SCROLL : null]} {...(self ? SELF_SCROLLBAR : null)}>
      <View style={[{ flexGrow: 1 }, contentContainerStyle]}>{children}</View>
    </View>
  );
});
