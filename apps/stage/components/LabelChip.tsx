import type { ReactNode } from 'react';
import { Row } from './layout';
import { LabelText } from './LabelText';
import { usePalette } from '../lib/theme';

export const LABEL_CHIP_ICON_SIZE = 14;

export function LabelChip({ label, selected = false, leading, trailing, background }: {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  background?: string;
}): React.ReactElement {
  const { link, text: fg, bg, border } = usePalette();
  return (
    <Row
      height={26}
      radius="full"
      padding={{ x: 9, y: 2 }}
      gap={4}
      align="center"
      background={selected ? link : background ?? border}
    >
      {leading}
      <LabelText label={label} size="xs" color={selected ? bg : fg} truncate />
      {trailing}
    </Row>
  );
}
