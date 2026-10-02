import { useCallback, memo } from 'react';
import { useActiveAccountRecord } from '../../../modules/messaging';
import { useWalletPortfolio } from './data';
import type { BalancePrices } from './balance.model';
import { WalletBalanceCard } from './BalanceCard';
import { useBalanceCurrency } from './currency';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { usePullToRefresh } from '../../tabs/PullToRefresh';
import type { SimultaneousRefs } from '../../SwipeTabs.types';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { walletTotalUsd, tokenRowModel } from './model';
import { useRouter } from 'expo-router';
import { usePeerProfiles } from '../../../lib/peerProfiles';
import { DANGER, usePalette } from '../../../lib/theme';
import { Box, Col, ScreenScroll, PAGE_GUTTER, Row } from '../../layout';
import { useWalletFocused } from '../../tabs/useWalletFocused';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';
import { TokenAvatar } from './tokenAvatar';
import { TokenRowBody } from '../TokenRowView';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';

const TOKEN_AVATAR_SIZE = 44;
const TOKEN_BADGE_SIZE = 20;

const TokenRow = memo(function TokenRow({ r, border, bg }: { r: AssetRow; border: string; bg: string }): React.ReactElement {
  return (
    <Row padding={{ y: 14 }} align="center" gap={12}>
      <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} size={TOKEN_AVATAR_SIZE} badgeSize={TOKEN_BADGE_SIZE} />
      <Box flex={1}>
        <TokenRowBody
          {...tokenRowModel(r, { fmtUsd, fmtBalance })}
          showAvatar={false}
        />
      </Box>
    </Row>
  );
});

function TokensList({
  rows, border, bg,
}: {
  rows: AssetRow[];
  border: string;
  bg: string;
}): React.ReactElement {
  return (
    <Col margin={{ x: PAGE_GUTTER }}>
      {rows.map(r => (
        <TokenRow
          key={tokenRowId(r)}
          r={r} border={border} bg={bg}
        />
      ))}
    </Col>
  );
}

const TOKENS_SPINNER = 28;

interface WalletBalances {
  address: string;
  rows: AssetRow[] | null;
  prices: BalancePrices | undefined;
  err: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function useWalletBalances(focused: boolean): WalletBalances {
  const address = useActiveAccountRecord()?.address ?? '';
  const rows = useWalletPortfolio(address, focused);
  const refetch = rows.refetch;

  const onRefresh = useCallback((): void => {
    if (!address) return;
    void refetch();
  }, [address, refetch]);

  return {
    address,
    rows: rows.data?.rows ?? null,
    prices: rows.data?.prices,
    err: rows.error ? rows.error.message : '',
    refreshing: rows.isRefetching,
    onRefresh,
  };
}

function WalletTokens({ rows, err, c }: {
  rows: WalletBalances['rows']; err: boolean;
  c: { border: string; bg: string };
}): React.ReactElement {
  if (err && rows === null) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Text size="2xs" color={DANGER}>Couldn’t load tokens</Text>
      </Col>
    );
  }
  if (rows === null) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center"><Spinner size={TOKENS_SPINNER} /></Col>
    );
  }
  return (
    <Box margin={{ top: 16 }}>
      <TokensList rows={rows} border={c.border} bg={c.bg}/>
    </Box>
  );
}

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { link: head, bg, border } = usePalette();
  const focused = useWalletFocused();

  const { address, rows, prices, err, refreshing, onRefresh } = useWalletBalances(focused);
  const currency = useBalanceCurrency();
  usePeerProfiles([address]);
  const pull = usePullToRefresh(refreshing, onRefresh, head);

  const totalUsd = walletTotalUsd(rows);
  const c = { border, bg };

  const onWalletAction = useCallback((action: string): void => {
    if (action === 'send') router.push('/wallet/send');
    else if (action === 'receive') router.push('/wallet/receive');
  }, [router]);

  return (
    <Col surface="surface" flex={1}>
    <ScreenScroll
      simultaneousHandlers={panRef}
      style={{ backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      bounces
      alwaysBounceVertical
      overScrollMode="always"
      nestedScrollEnabled
      onScroll={pull.onScroll}
      onScrollBeginDrag={pull.onScrollBeginDrag}
      onScrollEndDrag={pull.onScrollEndDrag}
      scrollEventThrottle={pull.scrollEventThrottle}
>
      <WalletBalanceCard
        balance={{
          totalUsd, currency, prices,
          loading: rows === null, error: !!err, refreshing,
          pricesLoading: refreshing,
        }}
        border={border} onAction={onWalletAction}
      />

      <WalletTokens rows={rows} err={!!err} c={c} />
    </ScreenScroll>
    </Col>
  );
}
