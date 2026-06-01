/** Colors story tab — enumerates EVERY named color variable the app palette
 *  exposes (lib/theme.ts `Palette`) for the active theme, one swatch row each:
 *  a small rounded box filled with the value + the variable name + its hex.
 *  Sourced from usePalette() so the theme switcher above flips the whole grid.
 *  Fonts: Calibre-Medium / Calibre-Semibold only. */

import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { usePalette, type Palette } from '../../lib/theme';
import { type ControlPalette } from './KitControls';

/** The palette keys in display order — typed against Palette so it can never
 *  drift from the actual shape (a missing/extra key fails the typecheck). */
const COLOR_KEYS: ReadonlyArray<keyof Palette> = [
  'fg', 'head', 'sub', 'bg', 'border', 'rowBg',
];

function Swatch({ name, value, p }: {
  name: string; value: string; p: ControlPalette;
}): React.ReactElement {
  return (
    <Row gap={14} mt={12} style={{ alignItems: 'center' }}>
      <Box
        style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: value,
          borderWidth: 1, borderColor: p.border,
        }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
          {name}
        </Text>
        <Text style={{ color: p.sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
          {value}
        </Text>
      </Box>
    </Row>
  );
}

export function KitColorsStory({ p }: { p: ControlPalette }): React.ReactElement {
  const palette = usePalette();
  return (
    <Box>
      <Text dark={p.dark} color={p.sub} variant="caption" weight="medium" style={{ marginTop: 16 }}>
        {`${COLOR_KEYS.length} palette colors · active theme`}
      </Text>
      <Box mt={2}>
        {COLOR_KEYS.map((key) => (
          <Swatch key={key} name={key} value={palette[key]} p={p} />
        ))}
      </Box>
    </Box>
  );
}
