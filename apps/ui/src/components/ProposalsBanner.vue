<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { banner, BANNER_PRESS } from '@stage-labs/views';
import { listRoot } from '@/lib/kitRow';
import { useProposalCount } from '../lib/useProposals';

const router = useRouter();
const { count } = useProposalCount();

const node = computed(() =>
  listRoot(
    banner({
      icon: 'statusOnline',
      label: count.value === 1 ? '1 pending request' : `${count.value} pending requests`,
    }),
  ),
);

const registry: WidgetActionRegistry = {
  [BANNER_PRESS]: () => { void router.push('/proposals'); },
};
</script>

<template>
  <Box
    v-if="count > 0"
    class="w-full shrink-0 border-b border-metro-border-light dark:border-metro-border-dark"
  >
    <KitRenderer :node="node" :registry="registry" />
  </Box>
</template>
