<script setup lang="ts">

import { computed } from 'vue';
import type { ActivityRow } from '@stage-labs/client/api/etherscan';
import {
  DIR_ICON, txTitle, txPartyLabel, txValuePrefix, txValueColor, relTime,
} from '@/lib/activityFormat';

const props = defineProps<{ r: ActivityRow; profileVersion: number }>();

const title = computed(() => txTitle(props.r));
const party = computed(() => {
  void props.profileVersion;
  return `${txPartyLabel(props.r)} · ${relTime(props.r.timestamp)}`;
});
const valueColor = computed(() => txValueColor(props.r));
const valueText = computed(() =>
  (props.r.valueEth === '0' ? '—' : `${txValuePrefix(props.r)}${props.r.valueEth} ETH`));
const subText = computed(() => (props.r.failed ? 'Failed' : `#${props.r.nonce}`));
</script>

<template>
  <Row align="center" :gap="12" class="py-3.5 border-b border-metro-border-light dark:border-metro-border-dark">
    <Box
      class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
        bg-metro-border-light dark:bg-metro-border-dark"
    >
      <Icon
        :name="DIR_ICON[props.r.direction]"
        :size="18"
        :class="props.r.failed
          ? 'text-metro-danger-light dark:text-metro-danger-dark'
          : 'text-metro-link-light dark:text-metro-link-dark'"
      />
    </Box>

    <Col class="flex-1 min-w-0">
      <Text size="xl" weight="semibold" color="link" :truncate="true">{{ title }}</Text>
      <Row align="center" :gap="6" class="mt-0.5 min-w-0">
        <Box class="rounded shrink-0 px-1.5 py-px bg-metro-border-light dark:bg-metro-border-dark">
          <Text size="xs" color="secondary">{{ props.r.chainLabel }}</Text>
        </Box>
        <Text size="md" color="secondary" class="flex-1 min-w-0" :truncate="true">{{ party }}</Text>
      </Row>
    </Col>

    <Col align="end" class="shrink-0">
      <Text size="xl" weight="semibold" :color="valueColor">{{ valueText }}</Text>
      <Text size="md" :color="props.r.failed ? 'danger' : 'secondary'" class="mt-0.5">{{ subText }}</Text>
    </Col>
  </Row>
</template>
