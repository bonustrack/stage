<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ActivityRow } from '@stage-labs/client/api/etherscan';
import { basicRoot, txRow, type TxDirection } from '@stage-labs/views';
import { txTitle, txPartyLabel, relTime } from '@stage-labs/client/wallet/activityFormat';

const props = defineProps<{ r: ActivityRow; profileVersion: number }>();

const DIRECTION: Record<ActivityRow['direction'], TxDirection> = {
  send: 'out', receive: 'in', self: 'self',
};

const node = computed(() => {
  void props.profileVersion;
  return basicRoot(
    txRow({
      direction: DIRECTION[props.r.direction],
      title: txTitle(props.r),
      amount: props.r.valueEth,
      token: 'ETH',
      timestamp: relTime(props.r.timestamp),
      counterparty: txPartyLabel(props.r),
      chainLabel: props.r.chainLabel,
      subText: props.r.failed ? 'Failed' : `#${props.r.nonce}`,
      failed: props.r.failed,
    }),
  );
});
</script>

<template>
  <Box class="py-3.5 border-b border-metro-border-light dark:border-metro-border-dark">
    <ViewHost :node="node" />
  </Box>
</template>
