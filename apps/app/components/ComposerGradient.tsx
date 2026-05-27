/** Top-fade or bottom-fade gradient strip.
 *
 *  Implemented as a stack of thin solid slices with stepped opacity rather than a
 *  react-native-svg `LinearGradient`. On Android, react-native-svg gradients render
 *  unreliably here: alpha baked into `stopColor` (rgba) gets dropped — the fade
 *  collapses to a solid same-colour bar (invisible over a matching background) —
 *  and percentage `Rect` dims inside an auto-sized absolute container can compute
 *  to 0, so nothing draws at all. Stepped `View`s are plain RN core: they always
 *  render and give a clean linear 0→100% opacity ramp on every device. */

import { View } from 'react-native';

interface Props {
  bg: string;
  /** 'down' (default): transparent at top → solid at bottom (sits above composer).
   *  'up':              solid at top → transparent at bottom (sits below status bar). */
  direction?: 'up' | 'down';
  height?: number;
  /** Absolute positioning offsets relative to the wrapping View. `left`/`right`
   *  default to 0; pass negatives to bleed past a padded parent (RN insets
   *  absolute children by the parent's padding, so a fade inside a padded
   *  container otherwise leaves un-faded strips at the screen edges). */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** Slice count across the strip — 16 over a 24px strip (1.5px each) reads as a
 *  smooth ramp without visible banding. */
const SLICES = 16;

export function ComposerGradient({ bg, direction = 'down', height = 24, top, bottom, left = 0, right = 0 }: Props): React.ReactElement {
  const sliceH = height / SLICES;
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left, right, height,
      ...(top !== undefined ? { top } : {}),
      ...(bottom !== undefined ? { bottom } : {}),
    }}>
      {Array.from({ length: SLICES }, (_, i) => {
        /** Slice position as a 0→1 fraction, top→bottom, hitting the EXACT
         *  endpoints (t=0 and t=1) so the strip is fully transparent at one edge
         *  and fully solid at the other — a true linear 0→100% ramp, no residual
         *  tint over content. 'down' ramps opacity up (transparent top → solid
         *  bottom); 'up' ramps it down. */
        const t = i / (SLICES - 1);
        const opacity = direction === 'down' ? t : 1 - t;
        return <View key={i} style={{ height: sliceH, backgroundColor: bg, opacity }} />;
      })}
    </View>
  );
}
