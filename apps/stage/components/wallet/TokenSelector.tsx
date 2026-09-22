import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { Box, Row, Col } from '../layout';
import { AppModal } from '../AppModal';
import { Spinner } from '../Spinner';
import { TokenRowBody } from '../wallet/TokenRowView';
import { usePalette } from '../../lib/theme';
import { useActiveAccountRecord } from '../../modules/messaging';
import { useAssetRows } from './screen/data';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '@stage-labs/client/wallet/assets';

export interface TokenChoice { symbol: string; chainId: number }

function findRow(rows: AssetRow[], sel: TokenChoice): AssetRow | undefined {
  return rows.find(r => r.symbol === sel.symbol && r.chainId === sel.chainId);
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

function useSelectorRows(): { rows: AssetRow[]; loading: boolean } {
  const address = useActiveAccountRecord()?.address ?? '';
  const publicRows = useAssetRows(address).data ?? null;
  return { rows: byValueDesc((publicRows ?? []).filter(hasBalance)), loading: publicRows === null };
}

export function useTopToken(): TokenChoice | null {
  const { rows } = useSelectorRows();
  const top = rows[0];
  return top ? { symbol: top.symbol, chainId: top.chainId } : null;
}

function rowKey(r: AssetRow): string {
  return `${r.chainId}:${r.symbol}`;
}

function TokenChoiceList({ rows, onPick }: {
  rows: AssetRow[];
  onPick: (r: AssetRow) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListView dark={dark}>
      {rows.map((r) => {
        const change = r.change24h === null ? '' : `${r.change24h >= 0 ? '+' : ''}${r.change24h.toFixed(2)}%`;
        const price = r.priceUsd === null ? r.symbol : fmtUsd(r.priceUsd, r.priceUsd < 1 ? 4 : 2);
        return (
          <ListViewItem
            key={rowKey(r)}
            align="center"
            gap={12}
            dark={dark}
            onPress={() => { onPick(r); }}
          >
            <TokenRowBody
              symbol={r.symbol}
              name={price}
              priceUsd={price}
              balance={`${fmtBalance(r.balance)} ${r.symbol}`}
              change24h={change}
              logoUri={r.logoUrl}
              chainBadgeUri={NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO}
              showAvatar
              trailingChevron={false}
            />
          </ListViewItem>
        );
      })}
    </ListView>
  );
}

export function TokenSelector({ value, onChange }: {
  value: TokenChoice;
  onChange: (v: TokenChoice) => void;
}): React.ReactElement {
  const { text: fg, link: head, border, bg } = usePalette();
  const [open, setOpen] = useState(false);
  const { rows, loading } = useSelectorRows();
  const selected = findRow(rows, value);

  const onPick = (r: AssetRow): void => {
    onChange({ symbol: r.symbol, chainId: r.chainId });
    setOpen(false);
  };

  return (
    <Box gap={6}>
      <Text size="xs" role="secondary">TOKEN</Text>
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
          <Text weight="semibold" size="md" color={head} numberOfLines={1}>
            {value.symbol}
          </Text>
          <Text size="xs" role="secondary" numberOfLines={1}>
            {selected ? `Balance: ${selected.balance}` : '-'}
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
          <TokenChoiceList rows={rows} onPick={onPick} />
        )}
      </AppModal>
    </Box>
  );
}

export function useSelectedBalance(value: TokenChoice): string | null {
  const { rows } = useSelectorRows();
  return findRow(rows, value)?.balance ?? null;
}
