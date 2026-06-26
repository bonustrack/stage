import type { BasicNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { addressCard } from './addressCard';

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
          color: '#000000',
          background: '#ffffff',
        },
      ]
    : [{ type: 'Box', width: 240, height: 240, background: '#f4f4f5' }];
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
            background: '#ffffff',
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
