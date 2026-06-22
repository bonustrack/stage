<script setup lang="ts">

import type { WalletTab } from '@/lib/walletTab';
import { WALLET_TABS } from '@/lib/walletTab';

const props = defineProps<{ modelValue: WalletTab }>();
const emit = defineEmits<{ 'update:modelValue': [tab: WalletTab] }>();

const TABS = WALLET_TABS;

function select(tab: WalletTab): void {
  emit('update:modelValue', tab);
}
</script>

<template>
  <Row
    align="center"
    :gap="24"
    class="px-4 mt-3 mb-1.5 border-b border-metro-border-light dark:border-metro-border-dark"
  >
    <Pressable
      v-for="tab in TABS"
      :key="tab.id"
      tag="button"
      type="button"
      class="py-2.5 -mb-px border-b-2"
      :class="props.modelValue === tab.id
        ? 'border-metro-link-light dark:border-metro-link-dark'
        : 'border-transparent'"
      @click="select(tab.id)"
    >
      <Text size="3xl" weight="semibold" :color="props.modelValue === tab.id ? 'link' : 'secondary'">
        {{ tab.label }}
      </Text>
    </Pressable>
  </Row>
</template>
