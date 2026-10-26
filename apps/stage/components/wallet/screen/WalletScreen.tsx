import { useCallback, memo } from 'react';
import { useActiveAccountRecord } from '../../../modules/messaging/account';
import { useWalletPortfolio } from './data';
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
import { useWalletFocused } from '../../tabs/useWalletFocused';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';
import { TokenAvatar } from './tokenAvatar';
import { TokenRowBody } from '../TokenRowView';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { Column, ScreenScroll, PAGE_GUTTER, Row } from '../../layout';

const TOKEN_AVATAR_SIZE = 44;
const TOKEN_BADGE_SIZE = 20;

const TokenRow = memo(function TokenRow({ r, border, bg }: { r: AssetRow; border: string; bg: string }): React.ReactElement {
  return (
    <Row padding={{ y: 14 }} align="center" gap={12}>
      <TokenAvatar logoUrl={r.logoUrl} chainId={r.chainId} bg={bg} border={border} size={TOKEN_AVATAR_SIZE} badgeSize={TOKEN_BADGE_SIZE} />
      <Column weight={1}>
        <TokenRowBody {...tokenRowModel(r, { fmtUsd, fmtBalance })} />
      </Column>
    </Row>
  );
});

const TOKENS_SPINNER = 28;

function WalletTokens({ rows, err, border, bg }: {
  rows: AssetRow[] | null; err: boolean; border: string; bg: string;
}): React.ReactElement {
  if (err && rows === null) {
    return (
      <Column padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Text size="xs" color={DANGER}>Couldn’t load tokens</Text>
      </Column>
    );
  }
  if (rows === null) {
    return (
      <Column padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center"><Spinner size={TOKENS_SPINNER} /></Column>
    );
  }
  return (
    <Column margin={{ top: 16, x: PAGE_GUTTER }}>
      {rows.map(r => <TokenRow key={tokenRowId(r)} r={r} border={border} bg={bg} />)}
    </Column>
  );
}

export function WalletScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { link: head, bg, border } = usePalette();
  const focused = useWalletFocused();

  const address = useActiveAccountRecord()?.address ?? '';
  const portfolio = useWalletPortfolio(address, focused);
  const { refetch } = portfolio;
  const onRefresh = useCallback((): void => {
    if (!address) return;
    void refetch();
  }, [address, refetch]);
  const rows = portfolio.data?.rows ?? null;
  const err = !!portfolio.error?.message;
  const refreshing = portfolio.isRefetching;
  const currency = useBalanceCurrency();
  usePeerProfiles([address]);
  const pull = usePullToRefresh(refreshing, onRefresh, head);

  return (
    <Column surface="surface" weight={1}>
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
          totalUsd: walletTotalUsd(rows), currency, prices: portfolio.data?.prices,
          loading: rows === null, error: err, refreshing,
          pricesLoading: refreshing,
        }}
        border={border} onAction={(href) => { router.push(href); }}
      />

      <WalletTokens rows={rows} err={err} border={border} bg={bg} />
    </ScreenScroll>
    </Column>
  );
}
