
import { resolveBadgeStyle, type BadgeColor, type BadgeSize, type BadgeVariant } from '../badge';
import { Box } from './box';
import { Text } from './text';
import { useKitScheme } from './theme-context';

export type { BadgeColor, BadgeSize, BadgeVariant };

export interface BadgeProps {
  label: string;
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
  dark?: boolean;
}

const PAD_X: Record<BadgeSize, number> = {
  '3xs': 5, '2xs': 6, sm: 8, md: 10, lg: 12,
};

const PAD_Y: Record<BadgeSize, number> = {
  '3xs': 1, '2xs': 1, sm: 2, md: 3, lg: 4,
};

export function Badge({ label, color, variant, size = 'sm', pill, dark }: BadgeProps): React.ReactElement {
  const scheme = useKitScheme();
  const styled = resolveBadgeStyle(color, undefined, size, dark === undefined ? scheme : (dark ? 'dark' : 'light'), variant);
  const side = styled.borderColor === undefined
    ? undefined
    : { width: 1, color: styled.borderColor };
  return (
    <Box
      direction="row"
      align="center"
      padding={{ x: PAD_X[size], y: PAD_Y[size] }}
      radius={pill === true ? 'full' : 'sm'}
      background={styled.background}
      border={side === undefined ? undefined : { top: side, right: side, bottom: side, left: side }}
    >
      <Text value={label} size={styled.fontToken} weight="semibold" color={styled.foreground} />
    </Box>
  );
}
