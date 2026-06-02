/** Button story tab — thin wrapper: local state seeded from BUTTON_SPEC, a live
 *  Button preview spread with the generated props, and the generic ControlsForm
 *  driving every prop (variant, size, label, pill, fullWidth, disabled, loading,
 *  icon). No bespoke form code — the form is data-driven from KitSpec. */

import { useState } from 'react';
import { Box } from '../layout';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { PreviewStage, type ControlPalette } from './KitControls';
import { ControlsForm } from './ControlsForm';
import { BUTTON_SPEC, defaultsOf, type ButtonState } from './KitSpec';

const ICON_PX: Record<ButtonState['size'], number> = { sm: 16, md: 18, lg: 20, xl: 26 };

/** Icon tint that reads on each variant's fill (mirrors the button text colour). */
function iconColorFor(variant: ButtonState['variant'], dark: boolean): string {
  if (variant === 'primary') return dark ? '#000000' : '#ffffff';
  if (variant === 'danger') return '#ffffff';
  return dark ? '#ffffff' : '#000000';
}

export function KitButtonStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark } = p;
  const [s, setS] = useState<ButtonState>(() => defaultsOf(BUTTON_SPEC));

  const px = ICON_PX[s.size];
  const tint = iconColorFor(s.variant, dark);
  const iconEl = <Icon name={s.icon} size={px} color={tint} />;

  return (
    <Box>
      <PreviewStage p={p}>
        <Button
          size={s.size}
          variant={s.variant}
          dark={dark}
          pill={s.pill}
          fullWidth={s.fullWidth}
          disabled={s.disabled}
          loading={s.loading}
          label={s.pill ? undefined : s.label}
          icon={iconEl}
        />
      </PreviewStage>

      <ControlsForm spec={BUTTON_SPEC} value={s} onChange={setS} p={p} />
    </Box>
  );
}
