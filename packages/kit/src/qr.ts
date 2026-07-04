
import { create } from 'qrcode';

export interface QrMatrix {
  count: number;
  cell: number;
  path: string;
}

export function buildQrMatrix(value: string, size: number): QrMatrix {
  const safe = value.length > 0 ? value : ' ';
  const qr = create(safe, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const data = qr.modules.data;
  const cell = size / count;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      const dark = data[row * count + col] === 1;
      if (!dark) continue;
      const x = col * cell;
      const y = row * cell;
      path += `M${x} ${y}h${cell}v${cell}h${-cell}z`;
    }
  }
  return { count, cell, path };
}
