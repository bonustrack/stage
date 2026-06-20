
import { ScrollView, type ScrollViewProps, type ViewStyle } from 'react-native';

export interface ScrollProps extends ScrollViewProps {
  padding?: number;
  gap?: number;
  horizontal?: boolean;
}

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
