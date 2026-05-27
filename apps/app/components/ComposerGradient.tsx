/** Top-fade or bottom-fade gradient strip — a single continuous react-native-svg
 *  LinearGradient (one smooth ramp, no stepped bands).
 *
 *  Two Android gotchas this avoids, learned the hard way:
 *   - alpha baked into an rgba `stopColor` gets dropped → the fade collapses to a
 *     solid same-colour bar (invisible over a matching bg). So the alpha lives in
 *     `stopOpacity`, and the stop colour stays the plain solid `bg`.
 *   - a percentage Svg/Rect HEIGHT can compute to 0 inside an auto-sized absolute
 *     container → nothing draws. So height is passed as a NUMBER and the gradient
 *     vector uses userSpaceOnUse over [0, height].
 *  A unique gradient id per instance (react-native-svg registers defs globally by
 *  id) avoids cross-instance collisions that otherwise compress the ramp. */

import { useId } from 'react';
import { View } from 'react-native';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';

interface Props {
  bg: string;
  /** 'down' (default): transparent at top → solid at bottom (sits above composer).
   *  'up':              solid at top → transparent at bottom (sits below the nav). */
  direction?: 'up' | 'down';
  height?: number;
  /** Absolute positioning offsets relative to the wrapping View. `left`/`right`
   *  default to 0; pass negatives to bleed past a padded parent. */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export function ComposerGradient({ bg, direction = 'down', height = 24, top, bottom, left = 0, right = 0 }: Props): React.ReactElement {
  const id = 'cg' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [o0, o1] = direction === 'down' ? [0, 1] : [1, 0];
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left, right, height,
      ...(top !== undefined ? { top } : {}),
      ...(bottom !== undefined ? { bottom } : {}),
    }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={bg} stopOpacity={o0} />
            <Stop offset="1" stopColor={bg} stopOpacity={o1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
