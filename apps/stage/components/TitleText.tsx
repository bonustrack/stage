import { Text, type TextProps } from '@stage-labs/kit/react-native/text';
import type { ConvTitle } from './conversation/convTitle';

export function titleTone(placeholder: boolean | undefined, color?: TextProps['color']): Pick<TextProps, 'color' | 'role'> {
  return placeholder === true ? { role: 'secondary' } : { color };
}

export function TitleText({ title, color, ...rest }: Omit<TextProps, 'value' | 'children' | 'role'> & {
  title: ConvTitle;
}): React.ReactElement {
  return <Text {...rest} {...titleTone(title.placeholder, color)}>{title.text}</Text>;
}
