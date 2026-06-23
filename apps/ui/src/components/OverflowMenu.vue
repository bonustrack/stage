<script setup lang="ts">

import type { HeroIconName } from '@stage-labs/kit/icons';
import { ref } from 'vue';

withDefaults(defineProps<{
  icon?: HeroIconName;
  size?: number;
  title?: string;
  align?: 'left' | 'right';
}>(), {
  icon: 'dotsHorizontal',
  size: 22,
  title: 'More',
  align: 'right',
});

const open = ref(false);
function close(): void { open.value = false; }
function run(fn: () => void): void { open.value = false; fn(); }

defineExpose({ close });
</script>

<template>
  <Pressable
    tag="button"
    type="button"
    class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
      hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
    :title="title"
    @click="open = true"
  >
    <Icon :name="icon" :size="size" />
  </Pressable>

  <template v-if="open">
    <Col class="fixed inset-0 z-40" @click="close" />
    <Col
      class="fixed top-[52px] z-50 min-w-[200px] py-1 rounded-lg shadow-lg
        bg-metro-bg-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      :class="align === 'right' ? 'right-2' : 'left-2'"
    >
      <slot :run="run" :close="close" />
    </Col>
  </template>
</template>
