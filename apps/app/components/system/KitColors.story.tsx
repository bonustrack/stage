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

/** The 5 canonical semantic tokens (single source of truth in kit/tokens),
 *  shown with their public `*-color` names. */
const TOKEN_ROWS: ReadonlyArray<readonly [label: string, key: keyof Palette]> = [
  ['bg-color', 'bg'],
  ['border-color', 'border'],
  ['text-color', 'text'],
  ['link-color', 'link'],
  ['primary-color', 'primary'],
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
      <Text dark={p.dark} color={p.sub} variant="caption" weight="medium" style={{ marginTop: 24 }}>
        {`${TOKEN_ROWS.length} canonical tokens · @metro-labs/kit`}
      </Text>
      <Box mt={2}>
        {TOKEN_ROWS.map(([label, key]) => (
          <Swatch key={label} name={label} value={palette[key]} p={p} />
        ))}
      </Box>
    </Box>
  );
}
