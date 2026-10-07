import { useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { Box, Row, Col } from '../layout';
import { Eyebrow } from '../Eyebrow';
import { AppModal } from '../AppModal';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { TokenRowBody } from './TokenRowView';
import { usePalette } from '../../lib/theme';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { useAssetRows } from './screen/data';
import { tokenChangeText, tokenPriceText, type TokenChoice } from './screen/model';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, type AssetRow } from '@stage-labs/client/wallet/assets';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';

function findRow(rows: AssetRow[], sel: TokenChoice): AssetRow | undefined {
  return rows.find(r => r.symbol === sel.symbol && r.chainId === sel.chainId);
}

function useSelectorRows(): { rows: AssetRow[]; loading: boolean } {
  const record = useActiveAccountRecord();
  const rows = useAssetRows(record?.address ?? '').data;
  return { rows: rows ?? [], loading: record === null || rows === undefined };
}

function TokenChoiceList({ rows, onPick }: {
  rows: AssetRow[];
  onPick: (r: AssetRow) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListView dark={dark}>
      {rows.map((r) => {
        const change = tokenChangeText(r.change24h);
        const price = tokenPriceText(r, fmtUsd);
        return (
          <ListViewItem
            key={tokenRowId(r)}
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
      <Eyebrow>TOKEN</Eyebrow>
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
          <Text weight="semibold" size="xs" color={head} numberOfLines={1}>
            {value.symbol}
          </Text>
          <Text size="4xs" role="secondary" numberOfLines={1}>
            {selected ? `Balance: ${selected.balance}` : '-'}
          </Text>
        </Col>
        <Glyph icon={IconChevronBottom} size={18} color={fg}/>
      </Pressable>

      <AppModal visible={open} onClose={() => { setOpen(false); }} title="Select token">
        {loading ? (
          <Row padding={{ y: 24 }} align="center" justify="center">
            <Spinner size={28} color={fg}/>
          </Row>
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
