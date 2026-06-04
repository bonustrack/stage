/** Colors story tab — enumerates EVERY named color variable the app palette
 *  exposes (lib/theme.ts `Palette`) for the active theme, one swatch row each:
 *  a small rounded box filled with the value + the variable name + its hex.
 *  Sourced from usePalette() so the theme switcher above flips the whole grid.
 *  Fonts: Calibre-Medium / Calibre-Semibold only. */

import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { usePalette, type Palette } from '../../lib/theme';
import { type ControlPalette } from './KitControls';

/** The 5 canonical palette keys in display order, with their public `*-color`
 *  names — typed against Palette so it can never drift from the actual shape
 *  (a missing/extra key fails the typecheck). Single source of truth lives in
 *  @metro-labs/kit/tokens; lib/theme.ts `Palette` maps 1:1 onto it. */
const TOKEN_ROWS: ReadonlyArray<readonly [label: string, key: keyof Palette]> = [
  ['bg-color', 'bg'],
  ['border-color', 'border'],
  ['text-color', 'text'],
  ['link-color', 'link'],
  ['primary-color', 'primary'],
  ['danger-color', 'danger'],
  ['success-color', 'success'],
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
        {`${TOKEN_ROWS.length} canonical tokens · @metro-labs/kit · active theme`}
      </Text>
      <Box mt={2}>
        {TOKEN_ROWS.map(([label, key]) => (
          <Swatch key={label} name={label} value={palette[key]} p={p} />
        ))}
      </Box>
    </Box>
  );
}
