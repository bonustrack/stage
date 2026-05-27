/** Renders a Heroicons v1 outline glyph. Path data lives in
 * @stage-labs/metro-kit (shared with apps/ui/src/components/HeroIcon.vue) so the
 * two clients keep one icon vocabulary. Stroke is currentColor, fill is
 * transparent, viewBox is the v1 outline standard 24×24. An active/focused
 * state can be signalled by thickening the stroke (see HERO_ICON_DEFAULTS).
 */

import { Path, Svg } from 'react-native-svg';
import { HERO_ICON_PATHS, HERO_ICON_DEFAULTS, type HeroIconName } from '@stage-labs/metro-kit/icons';

export type { HeroIconName };

interface Props {
  name: HeroIconName;
  size?: number;
  color?: string;
  focused?: boolean;
}

export function HeroIcon({ name, size = 24, color = 'currentColor' }: Props): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox={HERO_ICON_DEFAULTS.viewBox}>
      <Path
        d={HERO_ICON_PATHS[name]}
        fill="none"
        stroke={color}
        strokeWidth={HERO_ICON_DEFAULTS.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
