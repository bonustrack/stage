
import { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps, type ViewStyle } from 'react-native';

export interface ScrollProps extends ScrollViewProps {
  padding?: number;
  gap?: number;
  horizontal?: boolean;
}

const INDICATORS_BY_DEFAULT = Platform.OS === 'web';

export const Scroll = forwardRef<ScrollView, ScrollProps>(function Scroll(props, ref) {
  const { padding, gap, contentContainerStyle, children, ...rest } = props;

  const computed: ViewStyle | undefined =
    padding !== undefined || gap !== undefined
      ? { padding, gap }
      : undefined;

  const content = computed
    ? contentContainerStyle
      ? ([computed, contentContainerStyle].flat() as ViewStyle[])
      : computed
    : contentContainerStyle;

  return (
    <ScrollView
      contentContainerStyle={content}
      showsVerticalScrollIndicator={INDICATORS_BY_DEFAULT}
      showsHorizontalScrollIndicator={INDICATORS_BY_DEFAULT}
      {...rest}
      ref={ref}
    >
      {children}
    </ScrollView>
  );
});
