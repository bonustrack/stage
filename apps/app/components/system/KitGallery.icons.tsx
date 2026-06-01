/** Icon gallery for the Kit page — renders EVERY icon in the kit vocabulary in
 *  a wrapped grid, each glyph with its name label underneath. Names are sourced
 *  from @metro-labs/kit/icons (HERO_ICON_PATHS keys) so the grid stays in sync
 *  with the kit automatically. Uses the kit Icon + Text components. */

import { Box } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { HERO_ICON_PATHS } from '@metro-labs/kit/icons';
import { Text } from '@metro-labs/kit/text';

const ICON_NAMES = Object.keys(HERO_ICON_PATHS) as HeroIconName[];

const CELL_WIDTH = 76;
const ICON_PX = 24;

function IconCell({ name, dark, head, sub }: {
  name: HeroIconName; dark: boolean; head: string; sub: string;
}): React.ReactElement {
  return (
    <Box
      style={{
        width: CELL_WIDTH,
        alignItems: 'center',
        marginTop: 14,
        marginRight: 8,
      }}
    >
      <Icon name={name} size={ICON_PX} color={head} />
      <Text
        dark={dark}
        color={sub}
        variant="caption"
        weight="medium"
        size="sm"
        style={{ marginTop: 6, textAlign: 'center' }}
      >
        {name}
      </Text>
    </Box>
  );
}

export function IconGallery({ dark, head, sub }: {
  dark: boolean; head: string; sub: string;
}): React.ReactElement {
  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
      {ICON_NAMES.map((name) => (
        <IconCell key={name} name={name} dark={dark} head={head} sub={sub} />
      ))}
    </Box>
  );
}

export const ICON_COUNT = ICON_NAMES.length;
