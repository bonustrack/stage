import { Text, type TextProps } from '@stage-labs/kit/react-native/text';
import type { ConvTitle } from './conversation/convTitle';

export function titleTone(placeholder: boolean | undefined, color?: TextProps['color']): Pick<TextProps, 'color'> {
  return placeholder === true ? { color: 'secondary' } : { color };
}

export function TitleText({ title, color, ...rest }: Omit<TextProps, 'text' | 'children'> & { title: ConvTitle }): React.ReactElement {
  return (
    <Text {...rest} {...titleTone(title.placeholder, color)}>
      {title.text}
    </Text>
  );
}
