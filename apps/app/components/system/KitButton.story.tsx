/** Button story tab — live-editable Button preview on top, full size×variant×form
 *  grid below. Controls: variant (primary/secondary/ghost/danger), size (sm/md/lg),
 *  label text, pill toggle, icon on/off + icon-name picker from the kit vocab.
 *  All control state is local useState, typed against the kit's own unions
 *  (ButtonVariant / ButtonSize / HeroIconName) — no `any`. */

import { useState } from 'react';
import { Box } from '../layout';
import { Button, type ButtonSize, type ButtonVariant } from '@metro-labs/kit/button';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Segmented, TextField, ToggleField, PreviewStage, type ControlPalette } from './KitControls';
import { BUTTON_VARIANTS, ButtonVariantBlock } from './KitGallery.buttons';

const SIZES: ReadonlyArray<ButtonSize> = ['sm', 'md', 'lg'];
const ICON_CHOICES: ReadonlyArray<HeroIconName> = ['send', 'plus', 'check', 'reply', 'wallet'];
const ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

/** Icon tint that reads on each variant's fill (mirrors the gallery's logic). */
function iconColorFor(variant: ButtonVariant, dark: boolean): string {
  if (variant === 'primary') return dark ? '#000000' : '#ffffff';
  if (variant === 'danger') return '#ffffff';
  return dark ? '#ffffff' : '#000000';
}

export function KitButtonStory({ p }: { p: ControlPalette }): React.ReactElement {
  const { dark, sub } = p;
  const [variant, setVariant] = useState<ButtonVariant>('primary');
  const [size, setSize] = useState<ButtonSize>('md');
  const [label, setLabel] = useState<string>('Button');
  const [pill, setPill] = useState<boolean>(false);
  const [withIcon, setWithIcon] = useState<boolean>(false);
  const [iconName, setIconName] = useState<HeroIconName>('send');

  const px = ICON_PX[size];
  const iconEl = (withIcon || pill)
    ? <Icon name={iconName} size={px} color={iconColorFor(variant, dark)} />
    : undefined;

  return (
    <Box>
      <PreviewStage p={p}>
        <Button
          size={size}
          variant={variant}
          dark={dark}
          pill={pill}
          label={pill ? undefined : label}
          icon={iconEl}
        />
      </PreviewStage>

      <Segmented label="Variant" value={variant} options={BUTTON_VARIANTS}
        onChange={setVariant} p={p} />
      <Segmented label="Size" value={size} options={SIZES} onChange={setSize} p={p} />
      <TextField label="Label" value={label} onChange={setLabel} p={p} placeholder="Button" />
      <ToggleField label="Pill (icon-only)" value={pill} onChange={setPill} p={p} />
      <ToggleField label="With icon" value={withIcon} onChange={setWithIcon} p={p} />
      {(withIcon || pill) ? (
        <Segmented label="Icon" value={iconName} options={ICON_CHOICES}
          onChange={setIconName} p={p} />
      ) : null}

      <Box mt={24}>
        {BUTTON_VARIANTS.map((v) => (
          <ButtonVariantBlock key={v} variant={v} dark={dark} sub={sub} />
        ))}
      </Box>
    </Box>
  );
}
