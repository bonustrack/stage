import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { fetchAssetRows } from '@stage-labs/client/wallet/balances';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { WALLET_CHAIN_ID } from '@stage-labs/client/wallet/chains';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';
import { IconChevronBottom } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronBottom';
import { Eyebrow } from '../../Eyebrow';
import { AppModal } from '../../AppModal';
import { usePalette } from '../../../lib/theme';
import { useActiveAccountRecord } from '../../../lib/messaging/account';
import { TokenAvatar } from '../../token/TokenAvatar';
import { TokenRowBody } from '../../token/TokenRowBody';
import { tokenLogoOf, tokenRowModel } from '../../token/token.model';
import { Column, Row } from '../../layout';
import { sendRowFor } from './send.model';

const PICKER_AVATAR = { size: 40, badgeSize: 16 } as const;
const SELECTED_AVATAR = { size: 28, badgeSize: 15 } as const;

export interface SendRows {
  rows: AssetRow[];
  loading: boolean;
}

export function useSendRows(): SendRows {
  const record = useActiveAccountRecord();
  const address = record?.address ?? '';
  const { data } = useQuery({
    queryKey: ['assetRows', address.toLowerCase()],
    queryFn: () => fetchAssetRows(address),
    enabled: !!address,
    staleTime: 0,
  });
  return { rows: data ?? [], loading: record === null || data === undefined };
}

export function TokenSelector({
  value,
  rows: { rows, loading },
  onChange,
}: {
  value: string;
  rows: SendRows;
  onChange: (symbol: string) => void;
}): React.ReactElement {
  const { text: fg, link: head, border, bg } = usePalette();
  const dark = useKitScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const selected = sendRowFor(rows, value);
  return (
    <Column gap={6}>
      <Eyebrow>TOKEN</Eyebrow>
      <Pressable
        onPress={() => {
          setOpen(true);
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <TokenAvatar
          logoUrl={selected === undefined ? '' : tokenLogoOf(selected)}
          chainId={WALLET_CHAIN_ID}
          badge="corner"
          logoBackground={bg}
          ring={{ color: border, width: 2 }}
          {...SELECTED_AVATAR}
        />
        <Column minWidth={0} weight={1}>
          <Text fontWeight="semibold" size="xs" color={head} numberOfLines={1}>
            {value}
          </Text>
          <Text size="3xs" color="secondary" numberOfLines={1}>
            {selected ? `Balance: ${selected.balance}` : '-'}
          </Text>
        </Column>
        <Glyph icon={IconChevronBottom} size={18} color={fg} />
      </Pressable>
      <AppModal
        visible={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Select token"
      >
        {loading ? (
          <Row padding={{ y: 24 }} align="center" justify="center">
            <Spinner size={28} color={fg} />
          </Row>
        ) : (
          <ListView dark={dark}>
            {rows.map((r) => (
              <ListViewItem
                key={tokenRowId(r)}
                align="center"
                gap={12}
                dark={dark}
                onPress={() => {
                  onChange(r.symbol);
                  setOpen(false);
                }}
              >
                <TokenRowBody
                  {...tokenRowModel(r, 'picker')}
                  avatar={<TokenAvatar logoUrl={tokenLogoOf(r)} chainId={r.chainId} badge="below" {...PICKER_AVATAR} />}
                />
              </ListViewItem>
            ))}
          </ListView>
        )}
      </AppModal>
    </Column>
  );
}
