/** Text story tab — thin wrapper: state seeded from TEXT_SPEC, a live Text
 *  preview, and the generic ControlsForm driving variant + size + weight + text.
 *  No bespoke form code — fully data-driven from KitSpec. (The `mono` variant
 *  ignores weight — that's the kit's behaviour, faithfully reflected here.) */

import { useState } from 'react';
import { Box } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { TEXT_SPEC, defaultsOf, type TextState } from './KitSpec';

export function KitTextStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark } = p;
  const [s, setS] = useState<TextState>(() => defaultsOf(TEXT_SPEC));

  return (
    <Box>
      <PreviewStage p={p}>
        <Text dark={dark} variant={s.variant} size={s.size} weight={s.weight}>
          {s.text || ' '}
        </Text>
      </PreviewStage>

      <ControlsForm spec={TEXT_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
