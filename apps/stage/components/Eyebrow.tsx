import type { TextStyle } from 'react-native';
import { Text, type TextProps } from '@stage-labs/kit/react-native/text';

const TRACKING: TextStyle = { letterSpacing: 1 };

export function Eyebrow({ style, ...props }: TextProps): React.ReactElement {
  return <Text size="4xs" role="secondary" {...props} style={style === undefined ? TRACKING : [TRACKING].concat(style)}/>;
}
