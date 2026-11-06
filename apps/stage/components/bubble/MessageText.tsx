import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { textSelectable } from './interaction';

export const MESSAGE_BODY = { size: 'lg', lineHeight: 23 } as const;

type MessageTextProps = Omit<ComponentProps<typeof Text>, 'size'>;

export function MessageText({ selectable = textSelectable, style, ...rest }: MessageTextProps): React.ReactElement {
  return (
    <Text
      size={MESSAGE_BODY.size}
      selectable={selectable}
      style={{ lineHeight: MESSAGE_BODY.lineHeight, ...StyleSheet.flatten(style) }}
      {...rest}
    />
  );
}
