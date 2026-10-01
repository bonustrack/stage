import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';
import type { ScreenScrollHandle, ScreenScrollProps } from './ScreenScroll.types';

export const ScreenScroll = forwardRef<ScreenScrollHandle, ScreenScrollProps>(function ScreenScroll({ style, ...rest }, ref): React.ReactElement {
  const scroll = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => ({
    scrollToOffset: ({ offset, animated }) => { scroll.current?.scrollTo({ y: offset, animated: animated === true }); },
  }), []);
  return <ScrollView ref={scroll} style={[{ flex: 1 }, style]} showsVerticalScrollIndicator={false} {...rest} />;
});
