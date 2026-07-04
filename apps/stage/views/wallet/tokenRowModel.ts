export interface TokenRowAsset {
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  priceUsd: number | null;
  change24h: number | null;
  logoUrl: string;
  isPrivate?: boolean;
}

export interface TokenRowFormat {
  fmtUsd: (v: number, maxFrac?: number) => string;
  fmtBalance: (v: string) => string;
}

export interface TokenRowModelParams {
  tokenId: string;
  symbol: string;
  name: string;
  priceUsd: string;
  balance: string;
  change24h: string;
  logoUri: string;
  isPrivate?: boolean;
}

export function tokenRowModel(r: TokenRowAsset, f: TokenRowFormat): TokenRowModelParams {
  const valueUsd = r.priceUsd === null ? null : r.priceUsd * Number(r.balance);
  const priceText = r.priceUsd === null ? r.symbol : f.fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
  const changeText =
    r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
  return {
    tokenId: `${r.chainId}:${r.symbol}`,
    symbol: r.name,
    name: priceText,
    priceUsd: `${f.fmtBalance(r.balance)} ${r.symbol}`,
    balance: valueUsd === null ? '—' : f.fmtUsd(valueUsd),
    change24h: changeText,
    logoUri: r.logoUrl,
    isPrivate: r.isPrivate,
  };
}
