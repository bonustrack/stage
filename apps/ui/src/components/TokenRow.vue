<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { listRoot, tokenRow, WALLET_TOKEN_PRESS } from '@stage-labs/views';
import { rememberTokenRow } from '@/lib/tokenDetailStore';

const props = defineProps<{ r: AssetRow }>();

const router = useRouter();

function open(): void {
  const id = rememberTokenRow(props.r);
  void router.push(`/wallet/token/${encodeURIComponent(id)}`);
}

const actions = {
  [WALLET_TOKEN_PRESS]: (): void => {
    open();
  },
};

const valueUsd = computed(() =>
  (props.r.priceUsd === null ? null : props.r.priceUsd * Number(props.r.balance)));

const priceText = computed(() =>
  (props.r.priceUsd === null
    ? props.r.symbol
    : fmtUsd(props.r.priceUsd, props.r.priceUsd < 1 ? 4 : 2)));

const changeText = computed(() =>
  (props.r.change24h === null
    ? ''
    : `${props.r.change24h >= 0 ? '+' : ''}${props.r.change24h.toFixed(2)}%`));

const networkLogo = computed(() => NETWORK_LOGO[props.r.chainId] ?? MAINNET_NETWORK_LOGO);

const node = computed(() =>
  listRoot(
    tokenRow({
      tokenId: `${props.r.chainId}:${props.r.symbol}`,
      symbol: props.r.name,
      name: priceText.value,
      priceUsd: `${fmtBalance(props.r.balance)} ${props.r.symbol}`,
      balance: valueUsd.value === null ? '—' : fmtUsd(valueUsd.value),
      change24h: changeText.value,
      logoUri: props.r.logoUrl,
      chainBadgeUri: networkLogo.value,
    }),
  ),
);
</script>

<template>
  <ViewHost :node="node" :actions="actions" />
</template>
