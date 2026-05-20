/** Smooth top-fade above the composer card — react-native-svg LinearGradient. */

import { View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

export function ComposerGradient({ bg }: { bg: string }): React.ReactElement {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -40, height: 40 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="composerGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={bg} stopOpacity="0" />
            <Stop offset="1" stopColor={bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#composerGrad)" />
      </Svg>
    </View>
  );
}
