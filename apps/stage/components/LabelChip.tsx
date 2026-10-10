import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { LabelText } from './LabelText';
import { usePalette } from '../lib/theme';

export const LABEL_CHIP_ICON_SIZE = 14;

type LabelChipSize = 'xs' | '2xs';

const CHIP_BOX: Record<LabelChipSize, ViewStyle> = {
  xs: { height: 26, paddingLeft: 9, paddingRight: 9, gap: 4 },
  '2xs': { height: 23, paddingLeft: 8, paddingRight: 8, gap: 4 },
};

export function LabelChip({ label, selected = false, leading, trailing, background, size = 'xs' }: {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  background?: string;
  size?: LabelChipSize;
}): React.ReactElement {
  const { link, text: fg, bg, border } = usePalette();
  return (
    <Badge label={label} background={selected ? link : background ?? border} style={CHIP_BOX[size]}>
      {leading}
      <LabelText label={label} size={size} color={selected ? bg : fg} truncate />
      {trailing}
    </Badge>
  );
}
