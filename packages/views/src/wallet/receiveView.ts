import type { BasicNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { addressCard } from './addressCard';

const QR_FIXED_FOREGROUND = '#000000';
const QR_FIXED_BACKGROUND = '#ffffff';
const QR_PLACEHOLDER_BACKGROUND = '#f4f4f5';

export interface ReceiveViewParams {
  address: string;
  label: string;
  hint: string;
  borderColor: string | ThemeColor;
}

export function receiveView(params: ReceiveViewParams): BasicNode {
  const { address, label, hint, borderColor } = params;
  const qrChildren: WidgetNode[] = address
    ? [
        {
          type: 'QRCode',
          value: address,
          size: 240,
          color: QR_FIXED_FOREGROUND,
          background: QR_FIXED_BACKGROUND,
        },
      ]
    : [{ type: 'Box', width: 240, height: 240, background: QR_PLACEHOLDER_BACKGROUND }];
  return {
    type: 'Basic',
    children: [
      {
        type: 'Col',
        align: 'center',
        gap: 16,
        children: [
          {
            type: 'Box',
            background: QR_FIXED_BACKGROUND,
            radius: 'xl',
            padding: 16,
            align: 'center',
            justify: 'center',
            border: { size: 1, color: borderColor },
            children: qrChildren,
          },
          addressCard({
            label,
            address: address || '—',
            hint,
          }),
        ],
      },
    ],
  };
}
