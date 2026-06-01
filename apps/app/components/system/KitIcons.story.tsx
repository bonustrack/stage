/** Icons story tab — a name filter (text input) + a glyph-size control drive a
 *  live, filtered grid of EVERY kit icon. Names come from HERO_ICON_PATHS so the
 *  grid stays in sync with the kit. The size control is typed to a fixed set of
 *  px values; the filter is a case-insensitive substring match on the icon name. */

import { useMemo, useState } from 'react';
import { Box } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { HERO_ICON_PATHS } from '@metro-labs/kit/icons';
import { Text } from '@metro-labs/kit/text';
import { Segmented, TextField, type ControlPalette } from './KitControls';

const ICON_NAMES = Object.keys(HERO_ICON_PATHS) as HeroIconName[];
const SIZE_CHOICES: ReadonlyArray<number> = [16, 24, 32, 40];
const CELL_WIDTH = 76;

function IconCell({ name, size, p }: {
  name: HeroIconName; size: number; p: ControlPalette;
}): React.ReactElement {
  return (
    <Box style={{ width: CELL_WIDTH, alignItems: 'center', marginTop: 14, marginRight: 8 }}>
      <Box style={{ height: 40, justifyContent: 'center' }}>
        <Icon name={name} size={size} color={p.head} />
      </Box>
      <Text dark={p.dark} color={p.sub} variant="caption" weight="medium" size="sm"
        style={{ marginTop: 6, textAlign: 'center' }}>
        {name}
      </Text>
    </Box>
  );
}

export function KitIconsStory({ p }: { p: ControlPalette }): React.ReactElement {
  const [query, setQuery] = useState<string>('');
  const [size, setSize] = useState<number>(24);

  const matches = useMemo<HeroIconName[]>(() => {
    const q = query.trim().toLowerCase();
    return q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ICON_NAMES;
  }, [query]);

  return (
    <Box>
      <TextField label="Filter" value={query} onChange={setQuery} p={p}
        placeholder="Search icons by name…" />
      <Segmented label="Size" value={size} options={SIZE_CHOICES}
        onChange={setSize} labelOf={(s) => `${s}px`} p={p} />

      <Text dark={p.dark} color={p.sub} variant="caption" weight="medium" style={{ marginTop: 16 }}>
        {`${matches.length} of ${ICON_NAMES.length} icons`}
      </Text>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
        {matches.map((name) => (
          <IconCell key={name} name={name} size={size} p={p} />
        ))}
      </Box>
    </Box>
  );
}
