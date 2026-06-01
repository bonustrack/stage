/** Button gallery rows for the Kit page. For each kit ButtonSize (sm/md/lg)
 *  renders the button in THREE forms: text-only, text+icon, and icon-only (pill).
 *  Sizes come from packages/kit/src/button.styles.ts (SIZES). */

import { Box, Row } from '../layout';
import { Button, type ButtonSize, type ButtonVariant } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';

/** Every button size the kit supports, ascending. Typed as Record<ButtonSize,…>
 *  so adding a size to the kit's ButtonSize union breaks tsc here until the
 *  gallery is updated — the gallery can never silently miss a size. */
const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 40, lg: 48 };
const SIZES = Object.keys(SIZE_HEIGHT) as ButtonSize[];
const ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

/** Prominent badge naming the size + its real pixel height from the kit spec. */
function SizeLabel({ size, dark, sub }: {
  size: ButtonSize; dark: boolean; sub: string;
}): React.ReactElement {
  return (
    <Row gap={6} align="center" mt={8}>
      <Box style={{
        backgroundColor: dark ? '#282a2d' : '#e4e4e5',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}>
        <Text dark={dark} weight="semibold" size="sm" style={{ textTransform: 'uppercase' }}>
          {size}
        </Text>
      </Box>
      <Text dark={dark} color={sub} variant="caption" weight="medium">
        {SIZE_HEIGHT[size]}px
      </Text>
    </Row>
  );
}

function ButtonTriad({ size, variant, dark }: {
  size: ButtonSize; variant: ButtonVariant; dark: boolean;
}): React.ReactElement {
  const px = ICON_PX[size];
  const iconColor = variant === 'primary'
    ? (dark ? '#000000' : '#ffffff')
    : variant === 'danger' ? '#ffffff' : (dark ? '#ffffff' : '#000000');
  return (
    <Row gap={10} mt={8} align="center" style={{ flexWrap: 'wrap' }}>
      <Button size={size} variant={variant} dark={dark} label="Button" />
      <Button
        size={size}
        variant={variant}
        dark={dark}
        label="Button"
        icon={<Icon name="send" size={px} color={iconColor} />}
      />
      <Button
        size={size}
        variant={variant}
        dark={dark}
        pill
        icon={<Icon name="plus" size={px} color={iconColor} />}
      />
    </Row>
  );
}

export function ButtonVariantBlock({ variant, dark, sub }: {
  variant: ButtonVariant; dark: boolean; sub: string;
}): React.ReactElement {
  return (
    <Box style={{ marginTop: 14 }}>
      <Text dark={dark} color={sub} variant="caption" weight="semibold" style={{ textTransform: 'capitalize' }}>
        {variant}
      </Text>
      {SIZES.map((size) => (
        <Box key={size} style={{ marginTop: 4 }}>
          <SizeLabel size={size} dark={dark} sub={sub} />
          <ButtonTriad size={size} variant={variant} dark={dark} />
        </Box>
      ))}
    </Box>
  );
}

export const BUTTON_VARIANTS: ReadonlyArray<ButtonVariant> = ['primary', 'secondary', 'ghost', 'danger'];
