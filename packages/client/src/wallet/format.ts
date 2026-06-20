/** @file Pure Intl-only number/currency formatting helpers shared by the web and mobile wallet surfaces; the app re-exports them via its WalletScreen.parts shim so call sites stay stable. */

/** Format a plain `$` USD amount: request `en` (not the system locale) to get the bare `$` instead of `US$`, then strip any stray `US` prefix as a belt-and-suspenders for locales that ignore the hint. */
export function fmtUsd(v: number, maxFrac = 2): string {
  const s = v.toLocaleString('en', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: maxFrac,
  });
  return s.replace(/^US\$/, '$');
}

/** Split a formatted USD string into its integer part (incl. currency symbol + grouping) and its decimal fraction (incl. the leading `.`), so the decimals can render in a dimmer colour. Returns `dec: ''` when there are no decimals. */
export function splitUsd(s: string): { int: string; dec: string } {
  const i = s.lastIndexOf('.');
  return i === -1 ? { int: s, dec: '' } : { int: s.slice(0, i), dec: s.slice(i) };
}

/** Format a decimal-string token balance for display. Tighter precision for big numbers; more for dust — keeps the row clean without dropping informative digits on, say, 0.0034 ETH. */
export function fmtBalance(v: string): string {
  const n = Number(v);
  const max = n >= 1 ? 4 : 6;
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}
