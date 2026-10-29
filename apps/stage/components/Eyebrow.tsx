import { Text, type TextProps } from '@stage-labs/kit/react-native/text';

export function Eyebrow({ color = 'secondary', ...props }: TextProps): React.ReactElement {
  return <Text size="3xs" letterSpacing={1} {...props} color={color} />;
}
