/** Title story tab — thin wrapper: state seeded from TITLE_SPEC, a live Title
 *  preview, and the generic ControlsForm driving level + text. No bespoke form
 *  code — fully data-driven from KitSpec. */

import { useState } from 'react';
import { Box } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { TITLE_SPEC, defaultsOf, type TitleState } from './KitSpec';

export function KitTitleStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark, head } = p;
  const [s, setS] = useState<TitleState>(() => defaultsOf(TITLE_SPEC));

  return (
    <Box>
      <PreviewStage p={p}>
        <Title dark={dark} level={s.level} color={head}>
          {s.text || ' '}
        </Title>
      </PreviewStage>

      <ControlsForm spec={TITLE_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
