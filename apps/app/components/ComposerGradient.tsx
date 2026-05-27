/** Top-fade or bottom-fade gradient strip via react-native-svg LinearGradient. */

import { useId } from 'react';
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

/** `#rgb`/`#rrggbb` → `rgba(r,g,b,a)`. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function ComposerGradient({ bg, direction = 'down', height = 20, top, bottom }: Props): React.ReactElement {
  /** Unique id per instance — react-native-svg registers gradient defs globally
   *  by id, so a shared id collides when several fades are on screen. */
  const id = 'grad' + useId().replace(/[^a-zA-Z0-9]/g, '');
  /** Alpha baked into the stop COLORS (rgba) rather than stopOpacity: react-native-svg
   *  renders a 2-stop stopColor+stopOpacity gradient compressed toward the middle
   *  (~50% at the ends), so the fade never reaches 0%/100%. rgba color interpolation
   *  hits the true extremes — a clean linear 0→100% ramp. */
  const [c0, c1] = direction === 'down' ? [rgba(bg, 0), rgba(bg, 1)] : [rgba(bg, 1), rgba(bg, 0)];
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: 0, right: 0, height,
      ...(top !== undefined ? { top } : {}),
      ...(bottom !== undefined ? { bottom } : {}),
    }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c0} />
            <Stop offset="1" stopColor={c1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
