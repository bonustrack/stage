<script setup lang="ts">

import type { HeroIconName } from '@stage-labs/kit/icons';

withDefaults(defineProps<{
  icon: HeroIconName;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}>(), {
  danger: false,
  disabled: false,
});

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <Pressable
    tag="button"
    type="button"
    :disabled="disabled"
    class="w-full flex items-center gap-3 text-left px-3 py-2.5 text-sm disabled:opacity-50
      hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
    :class="danger ? 'text-red-500' : 'text-metro-head-light dark:text-metro-head-dark'"
    @click="emit('select')"
  >
    <Icon :name="icon" :size="20" />
    {{ label }}
  </Pressable>
</template>
