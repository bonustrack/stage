/** Button gallery rows for the Kit page. For each kit ButtonSize (sm/md/lg)
 *  renders the button in THREE forms: text-only, text+icon, and icon-only (pill).
 *  Sizes come from packages/kit/src/button.styles.ts (SIZES). */

import { Box, Row } from '../layout';
import { Button, type ButtonSize, type ButtonVariant } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';

const SIZES: ReadonlyArray<ButtonSize> = ['sm', 'md', 'lg'];
const ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

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
          <Text dark={dark} variant="secondary" weight="medium" size="sm">{size}</Text>
          <ButtonTriad size={size} variant={variant} dark={dark} />
        </Box>
      ))}
    </Box>
  );
}

export const BUTTON_VARIANTS: ReadonlyArray<ButtonVariant> = ['primary', 'secondary', 'ghost', 'danger'];
