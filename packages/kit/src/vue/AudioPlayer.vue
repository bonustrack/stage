<script setup lang="ts">
import { computed } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    src: string;
    duration?: number;
    dark?: boolean;
  }>(),
  {},
);

const emit = defineEmits<{ play: [] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const wrapStyle = computed<Record<string, string>>(() => ({
  padding: '10px',
  borderRadius: '12px',
  backgroundColor: isDark.value ? '#1c1c1e' : '#f0f0f2',
}));
</script>

<template>
  <div :style="wrapStyle">
    <audio
      :src="src"
      controls
      preload="metadata"
      :style="{ width: '100%', height: '36px' }"
      @play="emit('play')"
    />
  </div>
</template>
