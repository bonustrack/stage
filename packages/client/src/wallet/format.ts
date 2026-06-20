
export function fmtUsd(v: number, maxFrac = 2): string {
  const s = v.toLocaleString('en', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: maxFrac,
  });
  return s.replace(/^US\$/, '$');
}

export function splitUsd(s: string): { int: string; dec: string } {
  const i = s.lastIndexOf('.');
  return i === -1 ? { int: s, dec: '' } : { int: s.slice(0, i), dec: s.slice(i) };
}

export function fmtBalance(v: string): string {
  const n = Number(v);
  const max = n >= 1 ? 4 : 6;
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}
