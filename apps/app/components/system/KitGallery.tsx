/** Kit page — a Storybook-style explorer of @metro-labs/kit components. A single
 *  underline tab bar (KitTabs) switches between Title / Text / Button / Icons;
 *  each tab shows a live preview above a controls form that is DYNAMICALLY
 *  GENERATED from a per-component prop-spec (KitSpec) via the generic
 *  ControlsForm. Also hosts the app-wide theme switcher. */

import { Box } from '../layout';
import { ThemeSwitcher } from './ThemeSwitcher';
import { KitTabs } from './KitTabs';

export function KitGallery({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  return (
    <Box style={{ paddingBottom: 8 }}>
      <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />
      <Box style={{ paddingHorizontal: 16 }}>
        <KitTabs p={{ dark, head, sub, border, rowBg }} />
      </Box>
    </Box>
  );
}
