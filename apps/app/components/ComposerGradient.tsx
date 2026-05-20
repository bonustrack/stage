/** Top-fade or bottom-fade gradient strip via react-native-svg LinearGradient. */

import { View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

interface Props {
  bg: string;
  /** 'down' (default): transparent at top → solid at bottom (sits above composer).
   *  'up':              solid at top → transparent at bottom (sits below status bar). */
  direction?: 'up' | 'down';
  height?: number;
  /** Absolute positioning offsets relative to the wrapping View. */
  top?: number;
  bottom?: number;
}

export function ComposerGradient({ bg, direction = 'down', height = 20, top, bottom }: Props): React.ReactElement {
  const id = `grad-${direction}`;
  const [topOpacity, bottomOpacity] = direction === 'down' ? [0, 1] : [1, 0];
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: 0, right: 0, height,
      ...(top !== undefined ? { top } : {}),
      ...(bottom !== undefined ? { bottom } : {}),
    }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={bg} stopOpacity={topOpacity} />
            <Stop offset="1" stopColor={bg} stopOpacity={bottomOpacity} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
