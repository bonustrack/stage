import { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { FLEX_ALIGN, spacingEntries, type SpacingValue } from '../layout';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';

export type ListDirection = 'vertical' | 'horizontal';
export type ListAlign = 'start' | 'center' | 'end' | 'stretch';

export interface ListProps extends Omit<ScrollViewProps, 'horizontal' | 'style'>, A2uiCommonProps {
  direction?: ListDirection;
  align?: ListAlign;
  gap?: number;
  padding?: SpacingValue;
  style?: StyleProp<ViewStyle>;
}

const INDICATORS_BY_DEFAULT = Platform.OS === 'web';

function contentStyle(align: ListAlign | undefined, gap: number | undefined, padding: SpacingValue | undefined): ViewStyle {
  const style: ViewStyle = { gap, ...(spacingEntries('padding', padding) as ViewStyle) };
  if (align !== undefined) style.alignItems = align === 'stretch' ? 'stretch' : FLEX_ALIGN[align];
  return style;
}

export const List = forwardRef<ScrollView, ListProps>(function List(props, ref) {
  const { children, direction = 'vertical', align, gap, padding, style, weight, accessibility, contentContainerStyle, ...rest } = props;
  return (
    <ScrollView
      horizontal={direction === 'horizontal'}
      showsVerticalScrollIndicator={INDICATORS_BY_DEFAULT}
      showsHorizontalScrollIndicator={INDICATORS_BY_DEFAULT}
      {...accessibilityProps(accessibility)}
      {...rest}
      ref={ref}
      style={[weightStyle(weight), style]}
      contentContainerStyle={[contentStyle(align, gap, padding), contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
});
