import type { ReactNode } from 'react';
import { Row } from './layout';
import { LabelText } from './LabelText';
import { usePalette } from '../lib/theme';

export const LABEL_CHIP_ICON_SIZE = 14;

type LabelChipSize = 'xs' | '2xs';

const CHIP_BOX: Record<LabelChipSize, { height: number; paddingX: number }> = {
  xs: { height: 26, paddingX: 9 },
  '2xs': { height: 23, paddingX: 8 },
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
  const box = CHIP_BOX[size];
  return (
    <Row
      height={box.height}
      radius="full"
      padding={{ x: box.paddingX, y: 2 }}
      gap={4}
      align="center"
      background={selected ? link : background ?? border}
    >
      {leading}
      <LabelText label={label} size={size} color={selected ? bg : fg} truncate />
      {trailing}
    </Row>
  );
}
