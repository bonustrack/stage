/** Scroll - a thin Kit wrapper over RN `ScrollView`. Not a ChatKit widget
 *  node (ChatKit's chat shell owns its own scroll surface); this is the Kit
 *  escape hatch from objective 2 of the port plan so the app's ~24 raw
 *  `ScrollView` call sites import one Kit primitive instead of `react-native`
 *  directly. Keeping the renderer here means the ScrollView-vs-gesture-handler
 *  swap (or future virtualisation) is a one-file change.
 *
 *  Full `ScrollViewProps` passthrough, plus two ergonomic shorthands matching
 *  the Box/Row/Col spacing convention: `padding` (contentContainerStyle
 *  padding) and `gap` (contentContainerStyle gap). Numbers = px. */

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
