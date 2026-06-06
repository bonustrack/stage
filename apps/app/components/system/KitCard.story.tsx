/** Card story tab - thin wrapper: local state seeded from CARD_SPEC, a live
 *  Card preview spread with the generated props, and the generic ControlsForm
 *  driving size / body / status / collapsed / actions / pressable. No bespoke
 *  form code - fully data-driven from KitSpec. */

import { useState } from 'react';
import { Box } from '../layout';
import { Card } from '@metro-labs/kit/card';
import { Text } from '@metro-labs/kit/text';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { CARD_SPEC, defaultsOf, type CardStoryState } from './KitSpec';

export function KitCardStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark } = p;
  const [s, setS] = useState<CardStoryState>(() => defaultsOf(CARD_SPEC));

  return (
    <Box>
      <PreviewStage p={p}>
        <Card
          dark={dark}
          size={s.size}
          status={s.statusText ? { text: s.statusText } : undefined}
          collapsed={s.collapsed}
          confirm={s.withActions ? { label: 'Confirm', onPress: () => {} } : undefined}
          cancel={s.withActions ? { label: 'Cancel', onPress: () => {} } : undefined}
          onPress={s.pressable ? () => {} : undefined}
        >
          <Text dark={dark}>{s.body || ' '}</Text>
        </Card>
      </PreviewStage>

      <ControlsForm spec={CARD_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
