import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { LabelText } from './LabelText';
import { usePalette } from '../lib/theme';

export const LABEL_CHIP_ICON_SIZE = 14;

type LabelChipSize = 'md' | 'lg';

const CHIP_BOX: Record<LabelChipSize, ViewStyle> = {
  lg: { height: 26, paddingLeft: 9, paddingRight: 9, gap: 4 },
  md: { height: 23, paddingLeft: 8, paddingRight: 8, gap: 4 },
};

export function LabelChip({ label, selected = false, leading, trailing, background, size = 'lg' }: {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  background?: string;
  size?: LabelChipSize;
}): React.ReactElement {
  const { link, text: fg, bg, border } = usePalette();
  return (
    <Badge
      label={label}
      size={size}
      weight="normal"
      color={selected ? bg : fg}
      background={selected ? link : background ?? border}
      style={CHIP_BOX[size]}
    >
      {(text) => (
        <>
          {leading}
          <LabelText label={label} truncate {...text} />
          {trailing}
        </>
      )}
    </Badge>
  );
}
