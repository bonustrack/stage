import type { ReactNode } from 'react';
import type { RadiusValue } from '@stage-labs/kit/tokens';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Column } from '../layout';

export const QR_INK = '#000000';
const QR_PAPER = '#ffffff';

export function QrPanel({
  value,
  size,
  padding,
  radius,
  border,
  placeholder,
  accessibilityLabel,
}: {
  value: string | null;
  size: number;
  padding: number;
  radius: RadiusValue;
  border?: string;
  placeholder?: ReactNode;
  accessibilityLabel?: string;
}): React.ReactElement {
  const side = border === undefined ? undefined : { width: 1, color: border };
  return (
    <Column
      background={QR_PAPER}
      radius={radius}
      padding={padding}
      align="center"
      justify="center"
      border={side === undefined ? undefined : { top: side, right: side, bottom: side, left: side }}
      accessibilityLabel={accessibilityLabel}
    >
      {value === null ? placeholder : <QrCode value={value} size={size} color={QR_INK} background={QR_PAPER} />}
    </Column>
  );
}
