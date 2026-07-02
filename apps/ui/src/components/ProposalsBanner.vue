<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { listRoot, banner, navigateAction, BANNER_PRESS } from '@stage-labs/views';
import { capabilities } from '@/lib/capabilities';
import { useProposalCount } from '../lib/useProposals';

const { count } = useProposalCount();

const node = computed(() =>
  listRoot(
    banner({
      icon: 'statusOnline',
      label: count.value === 1 ? '1 pending request' : `${count.value} pending requests`,
    }),
  ),
);

const actions = {
  ...navigateAction(BANNER_PRESS, capabilities, () => '/proposals'),
};
</script>

<template>
  <Box
    v-if="count > 0"
    class="w-full shrink-0 border-b border-metro-border-light dark:border-metro-border-dark"
  >
    <ViewHost :node="node" :actions="actions" />
  </Box>
</template>
