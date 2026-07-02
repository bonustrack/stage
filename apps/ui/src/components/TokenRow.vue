<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { listRoot, tokenRow, tokenRowModel, WALLET_TOKEN_PRESS } from '@stage-labs/views';
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

const networkLogo = computed(() => NETWORK_LOGO[props.r.chainId] ?? MAINNET_NETWORK_LOGO);

const node = computed(() =>
  listRoot(
    tokenRow({
      ...tokenRowModel(props.r, { fmtUsd, fmtBalance }),
      chainBadgeUri: networkLogo.value,
    }),
  ),
);
</script>

<template>
  <ViewHost :node="node" :actions="actions" />
</template>
