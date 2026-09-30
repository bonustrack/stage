import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import type { ScreenScrollHandle, ScreenScrollProps } from './ScreenScroll.types';

export const ScreenScroll = forwardRef<ScreenScrollHandle, ScreenScrollProps>(function ScreenScroll({ style, scroll, ...rest }, ref): React.ReactElement {
  const view = useRef<ScrollView>(null);
  void scroll;
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({ offset, animated }) => { view.current?.scrollTo({ y: offset, animated: animated === true }); },
  }), []);
  return <ScrollView ref={view} style={[{ flex: 1 }, style]} showsVerticalScrollIndicator={false} {...rest} />;
});
