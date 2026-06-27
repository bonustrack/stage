<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { walletTabs, WALLET_TAB_CHANGE } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import type { WalletTab } from '@/lib/walletTab';
import { WALLET_TABS } from '@/lib/walletTab';

const props = defineProps<{ modelValue: WalletTab }>();
const emit = defineEmits<{ 'update:modelValue': [tab: WalletTab] }>();

const node = computed(() =>
  basicRoot(walletTabs({
    value: props.modelValue,
    options: WALLET_TABS.map((t) => ({ value: t.id, label: t.label })),
  })));

const registry: WidgetActionRegistry = {
  [WALLET_TAB_CHANGE]: (action) => {
    const next = action.payload.walletTab;
    if (typeof next === 'string') emit('update:modelValue', next as WalletTab);
  },
};
</script>

<template>
  <Row class="px-4 mt-3 mb-1.5 border-b border-metro-border-light dark:border-metro-border-dark">
    <KitRenderer :node="node" :registry="registry" />
  </Row>
</template>
