<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, walletTabs, WALLET_TAB_CHANGE } from '@stage-labs/views';
import type { WalletTab } from '@/lib/walletTab';
import { WALLET_TABS } from '@/lib/walletTab';

const props = defineProps<{ modelValue: WalletTab }>();
const emit = defineEmits<{ 'update:modelValue': [tab: WalletTab] }>();

const node = computed(() =>
  basicRoot(walletTabs({
    value: props.modelValue,
    options: WALLET_TABS.map((t) => ({ value: t.id, label: t.label })),
  })));

const actions = {
  [WALLET_TAB_CHANGE]: (payload: Record<string, unknown>): void => {
    const next = payload.walletTab;
    if (typeof next === 'string') emit('update:modelValue', next as WalletTab);
  },
};
</script>

<template>
  <Row class="px-4 mt-3 mb-1.5 border-b border-metro-border-light dark:border-metro-border-dark">
    <ViewHost :node="node" :actions="actions" />
  </Row>
</template>
