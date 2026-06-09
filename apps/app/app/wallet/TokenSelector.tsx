/** Shared token-selector field + modal for the four Wallet action pages
 *  (Send / Send-shielded / Shield / Unshield).
 *
 *  The selector is a tappable Kit-styled field that opens a bottom-sheet
 *  (AppModal) listing the available tokens. Each row REUSES the exact same
 *  `TokenRow` component the Wallet tab renders — avatar + network badge +
 *  per-unit price + balance — so the picker matches the wallet list 1:1.
 *
 *  Rows come from the live wallet data: PUBLIC mode pulls `fetchAssetRows`
 *  (on-chain multicall balances), SHIELDED mode derives rows from the active
 *  Railgun snapshot via `privateBalancesToRows`. Selecting a row reports the
 *  chosen { symbol, chainId } back up and the parent shows the same balance in
 *  the amount field.
 *
 *  No bespoke/gold styling — Kit `Text`/`Icon` + the palette tokens only. */
import { useEffect, useMemo, useState } from 'react';

import { Pressable } from '@metro-labs/kit/pressable';
import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box, Row, Col } from '../../components/layout';
import { AppModal } from '../../components/AppModal';
import { Spinner } from '../../components/Spinner';
import { usePalette } from '../../lib/theme';
import { getActiveAccount } from '../../lib/accounts';
import { fetchAssetRows } from '../../components/tabs/WalletScreen.data';
import { TokenRow } from '../../components/tabs/WalletScreen.parts';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '../../components/tabs/WalletScreen.assets';
import { privateBalancesToRows, symbolPricesFromPublic } from '../../components/tabs/WalletScreen.private.rows';
import { usePrivateWallet } from '../../lib/railgun/usePrivateWallet';

export type SelectorMode = 'public' | 'shielded' | 'combined';
export interface TokenChoice { symbol: string; chainId: number; isPrivate?: boolean }

/** Find the AssetRow matching the current selection (for the field + balance).
 *  Public ETH and shielded ETH share symbol+chainId, so the `isPrivate` flag is
 *  part of the identity in combined mode. */
function findRow(rows: AssetRow[], sel: TokenChoice): AssetRow | undefined {
  return rows.find(r =>
    r.symbol === sel.symbol && r.chainId === sel.chainId && !!r.isPrivate === !!sel.isPrivate,
  );
}

/** True when a row's decimal-string balance parses to a positive number. Used to
 *  hide zero/empty-balance tokens from the selector. */
function hasBalance(r: AssetRow): boolean {
  const n = Number.parseFloat(r.balance);
  return Number.isFinite(n) && n> 0;
}

/** USD value of a row = balance × per-unit price. Rows with no price (CoinGecko
 *  miss) contribute 0 so they sort to the bottom. Drives the highest-value-first
 *  ordering of the selector list (and thus the page's default selection). */
function usdValue(r: AssetRow): number {
  const bal = Number.parseFloat(r.balance);
  if (!Number.isFinite(bal) || r.priceUsd == null) return 0;
  return bal * r.priceUsd;
}

/** Sort a copy of the rows descending by USD value (highest balance worth first). */
function byValueDesc(rows: AssetRow[]): AssetRow[] {
  return [...rows].sort((a, b) => usdValue(b) - usdValue(a));
}

/** Load the candidate token rows for the selector. PUBLIC = on-chain multicall;
 *  SHIELDED = the active Railgun snapshot mapped to rows. */
function useSelectorRows(mode: SelectorMode): { rows: AssetRow[]; loading: boolean } {
  const [publicRows, setPublicRows] = useState<AssetRow[] | null>(null);
  const { snapshot } = usePrivateWallet(mode === 'shielded' || mode === 'combined');

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const acct = await getActiveAccount();
        if (!acct?.address || cancelled) return;
        const next = await fetchAssetRows(acct.address);
        if (!cancelled) setPublicRows(next);
      } catch { /* leave null → spinner stays until retry/close */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const shieldedRows = useMemo(
    () => privateBalancesToRows(snapshot, symbolPricesFromPublic(publicRows ?? [])),
    [snapshot, publicRows],
  );

  if (mode === 'shielded') return { rows: byValueDesc(shieldedRows.filter(hasBalance)), loading: false };
  const pub = (publicRows ?? []).filter(hasBalance);
  if (mode === 'combined') {
    // Combined public + positive-balance shielded rows, sorted highest USD value
    // first (balance × price). Each row carries `isPrivate`, which the rows +
    // selection identity use to distinguish a public token from its shielded twin.
    return { rows: byValueDesc([...pub, ...shieldedRows.filter(hasBalance)]), loading: publicRows === null };
  }
  return { rows: byValueDesc(pub), loading: publicRows === null };
}

/** The highest-USD-value token in the list for `mode`, or null until rows load /
 *  if the wallet holds nothing. Lets a page default-select the most valuable
 *  holding instead of the hardcoded native token. */
export function useTopToken(mode: SelectorMode): TokenChoice | null {
  const { rows } = useSelectorRows(mode);
  const top = rows[0];
  return top ? { symbol: top.symbol, chainId: top.chainId, isPrivate: top.isPrivate } : null;
}

/** Tappable token field. Shows the selected token avatar + symbol + a chevron;
 *  opening it presents the modal list. */
export function TokenSelector({ mode, value, onChange, label = 'TOKEN' }: {
  mode: SelectorMode;
  value: TokenChoice;
  onChange: (v: TokenChoice) => void;
  label?: string;
}): React.ReactElement {
  const { text: fg, link: head, border, bg } = usePalette();
  const sub = fg;
  const [open, setOpen] = useState(false);
  const { rows, loading } = useSelectorRows(mode);
  const selected = findRow(rows, value);

  return (
    <Box gap={6}>
      <Text size="xs" color={sub}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: border, borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Box style={{ width: 28, height: 28 }}>
          <Image
            src={selected?.logoUrl ?? ''}
            style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: bg }}
          />
          <Box style={{
            position: 'absolute', right: -3, bottom: -3, width: 15, height: 15,
            borderRadius: 999, borderWidth: 2, borderColor: border, backgroundColor: bg,
            overflow: 'hidden',
          }}>
            <Image
              src={NETWORK_LOGO[value.chainId] ?? MAINNET_NETWORK_LOGO}
              fit="cover" style={{ width: '100%', height: '100%' }}
            />
          </Box>
        </Box>
        <Col flex={1} style={{ minWidth: 0 }}>
          <Row align="center" gap={6} style={{ minWidth: 0 }}>
            {value.isPrivate ? <Icon name="shieldCheck" size={14} color={sub} /> : null}
            <Text weight="semibold" size="md" color={head} numberOfLines={1}>
              {value.symbol}
            </Text>
          </Row>
          <Text size="xs" color={sub} numberOfLines={1}>
            {selected ? `Balance: ${selected.balance}` : '—'}
          </Text>
        </Col>
        <Icon name="chevronDown" size={18} color={fg} />
      </Pressable>

      <AppModal visible={open} onClose={() => setOpen(false)}>
        <Text weight="semibold" size="xl" color={head} style={{ marginBottom: 8 }}>
          Select token
        </Text>
        {loading ? (
          <Row padding={{ y: 24 }} align="center" justify="center">
            <Spinner size={28} color={fg} />
          </Row>
        ) : rows.length === 0 ? (
          <Text size="md" color={sub} style={{ paddingVertical: 16 }}>
            No tokens.
          </Text>
        ) : (
          rows.map((r) => (
            <TokenRow
              key={`${r.isPrivate ? 'priv' : 'pub'}:${r.chainId}:${r.symbol}`}
              r={r} head={head} sub={sub} border={border} bg={bg}
              onPress={() => { onChange({ symbol: r.symbol, chainId: r.chainId, isPrivate: r.isPrivate }); setOpen(false); }}
            />
          ))
        )}
      </AppModal>
    </Box>
  );
}

/** Helper for the parent amount field — returns the selected token's balance
 *  string (or null) so the page can render "Balance: …" and a Max button. */
export function useSelectedBalance(mode: SelectorMode, value: TokenChoice): string | null {
  const { rows } = useSelectorRows(mode);
  return findRow(rows, value)?.balance ?? null;
}
