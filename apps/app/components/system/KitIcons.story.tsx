/** Icon story tab — thin wrapper: state seeded from ICON_SPEC, a live Icon
 *  preview, and the generic ControlsForm driving name (full-vocab picker) + size
 *  + colour. No bespoke form code — fully data-driven from KitSpec. */

import { useState } from 'react';
import { Box } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { ICON_SPEC, defaultsOf, type IconState } from './KitSpec';

export function KitIconsStory({ p }: { p: ControlPalette }): React.ReactElement {
  const [s, setS] = useState<IconState>(() => defaultsOf(ICON_SPEC));

  return (
    <Box>
      <PreviewStage p={p}>
        <Icon name={s.name} size={s.size} color={s.color} />
      </PreviewStage>

      <ControlsForm spec={ICON_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
