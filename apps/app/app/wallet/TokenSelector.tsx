import { useEffect, useMemo, useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
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

function findRow(rows: AssetRow[], sel: TokenChoice): AssetRow | undefined {
  return rows.find(r =>
    r.symbol === sel.symbol && r.chainId === sel.chainId && !!r.isPrivate === !!sel.isPrivate,
  );
}

function hasBalance(r: AssetRow): boolean {
  const n = Number.parseFloat(r.balance);
  return Number.isFinite(n) && n> 0;
}

function usdValue(r: AssetRow): number {
  const bal = Number.parseFloat(r.balance);
  if (!Number.isFinite(bal) || r.priceUsd == null) return 0;
  return bal * r.priceUsd;
}

function byValueDesc(rows: AssetRow[]): AssetRow[] {
  return [...rows].sort((a, b) => usdValue(b) - usdValue(a));
}

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
      } catch { }
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
    return { rows: byValueDesc([...pub, ...shieldedRows.filter(hasBalance)]), loading: publicRows === null };
  }
  return { rows: byValueDesc(pub), loading: publicRows === null };
}

export function useTopToken(mode: SelectorMode): TokenChoice | null {
  const { rows } = useSelectorRows(mode);
  const top = rows[0];
  return top ? { symbol: top.symbol, chainId: top.chainId, isPrivate: top.isPrivate } : null;
}

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
      <Text size="xs" role="secondary">{label}</Text>
      <Pressable
        onPress={() => { setOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: border, borderRadius: 12,
          paddingHorizontal: 14, paddingVertical: 12,
          opacity: pressed ? 0.7 : 1,
        })}
>
        <Box width={28} height={28}>
          <Image
            src={selected?.logoUrl ?? ''}
            style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: bg }}
/>
          <Box width={15} height={15} radius="full" surface="surface" style={{ position: 'absolute', right: -3, bottom: -3, borderWidth: 2, borderColor: border, overflow: 'hidden' }}>
            <Image
              src={NETWORK_LOGO[value.chainId] ?? MAINNET_NETWORK_LOGO}
              fit="cover" style={{ width: '100%', height: '100%' }}
/>
          </Box>
        </Box>
        <Col minWidth={0} flex={1}>
          <Row minWidth={0} align="center" gap={6}>
            {value.isPrivate ? <Icon name="shieldCheck" size={14} color={sub} /> : null}
            <Text weight="semibold" size="md" color={head} numberOfLines={1}>
              {value.symbol}
            </Text>
          </Row>
          <Text size="xs" role="secondary" numberOfLines={1}>
            {selected ? `Balance: ${selected.balance}` : '—'}
          </Text>
        </Col>
        <Icon name="chevronDown" size={18} color={fg}/>
      </Pressable>

      <AppModal visible={open} onClose={() => { setOpen(false); }}>
        <Text weight="semibold" size="xl" color={head} style={{ marginBottom: 8 }}>
          Select token
        </Text>
        {loading ? (
          <Row padding={{ y: 24 }} align="center" justify="center">
            <Spinner size={28} color={fg}/>
          </Row>
        ) : rows.length === 0 ? (
          <Text size="md" role="secondary" style={{ paddingVertical: 16 }}>
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

export function useSelectedBalance(mode: SelectorMode, value: TokenChoice): string | null {
  const { rows } = useSelectorRows(mode);
  return findRow(rows, value)?.balance ?? null;
}
