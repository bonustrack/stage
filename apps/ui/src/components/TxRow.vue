<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ActivityRow } from '@stage-labs/client/api/etherscan';
import { basicRoot, txRow, txRowModel } from '@stage-labs/views';
import { txTitle, txPartyLabel, relTime } from '@stage-labs/client/wallet/activityFormat';

const props = defineProps<{ r: ActivityRow; profileVersion: number }>();

const node = computed(() => {
  void props.profileVersion;
  return basicRoot(
    txRow(txRowModel({
      direction: props.r.direction,
      title: txTitle(props.r),
      partyLabel: txPartyLabel(props.r),
      timeLabel: relTime(props.r.timestamp),
      valueEth: props.r.valueEth,
      chainLabel: props.r.chainLabel,
      nonce: props.r.nonce,
      failed: props.r.failed,
    })),
  );
});
</script>

<template>
  <Box class="py-3.5 border-b border-metro-border-light dark:border-metro-border-dark">
    <ViewHost :node="node" />
  </Box>
</template>
