export function fmtUsd(v: number, maxFrac = 2): string {
  const s = v.toLocaleString('en', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: maxFrac });
  return s.replace(/^US\$/, '$');
}

export function splitUsd(s: string): { int: string; dec: string } {
  const i = s.lastIndexOf('.');
  return i === -1 ? { int: s, dec: '' } : { int: s.slice(0, i), dec: s.slice(i) };
}

export function fmtTokenAmount(value: number, maxFractionDigits: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export function fmtBalance(v: string): string {
  const n = Number(v);
  return fmtTokenAmount(n, n >= 1 ? 4 : 6);
}

export function fmtLocalUsd(value: number, maxFractionDigits: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: maxFractionDigits });
}

export function truncateDecimals(value: string, digits: number): string {
  if (!value.includes('.')) return value;
  const [whole, frac] = value.split('.');
  const cut = (frac ?? '').slice(0, digits).replace(/0+$/, '');
  return cut ? `${whole ?? ''}.${cut}` : (whole ?? '');
}

export function fmtUsdValue(amount: string, priceUsd: number | null): string | null {
  if (priceUsd === null) return null;
  const n = Number(amount);
  if (!isFinite(n) || n === 0) return null;
  const v = n * priceUsd;
  if (v > 0 && v < 0.01) return '~<$0.01';
  const frac = v < 1 ? 4 : 2;
  return `~$${v.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: frac })}`;
}
