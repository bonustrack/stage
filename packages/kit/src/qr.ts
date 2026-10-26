import { encode } from 'uqr';

export interface QrMatrix {
  count: number;
  cell: number;
  path: string;
}

export function buildQrMatrix(value: string, size: number): QrMatrix {
  const safe = value.length > 0 ? value : ' ';
  const { data } = encode(safe, { ecc: 'M', boostEcc: false, border: 0 });
  const count = data.length;
  const cell = size / count;
  let path = '';
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x * cell} ${y * cell}h${cell}v${cell}h${-cell}z`;
    });
  });
  return { count, cell, path };
}
