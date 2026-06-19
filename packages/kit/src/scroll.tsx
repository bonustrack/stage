/**
 * @file Scroll — a thin Kit wrapper over RN `ScrollView` with full props passthrough plus `padding`/`gap` contentContainerStyle shorthands (numbers = px), so call sites depend on one Kit primitive.
 */

import { ScrollView, type ScrollViewProps, type ViewStyle } from 'react-native';

export interface ScrollProps extends ScrollViewProps {
  /** Uniform px padding applied to the scroll content container. */
  padding?: number;
  /** Gap (px) between content children (applied on the content container). */
  gap?: number;
  /** Lay the content out horizontally (RN `horizontal`). */
  horizontal?: boolean;
}

/** Kit RN scroll surface. */
export function Scroll(props: ScrollProps): React.ReactElement {
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
    <ScrollView contentContainerStyle={content} {...rest}>
      {children}
    </ScrollView>
  );
}
