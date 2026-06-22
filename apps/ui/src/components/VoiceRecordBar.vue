<script setup lang="ts">

import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { formatVoiceDuration } from '@stage-labs/client/xmtp/voice';

defineProps<{ seconds: number; levels: number[] }>();
const emit = defineEmits<(e: 'send' | 'cancel') => void>();

const palette = useKitPalette();
</script>

<template>
  <Col surface="raised" :padding="10">
    <Row class="flex items-center gap-3">
      <span class="w-2.5 h-2.5 rounded-full bg-metro-err animate-pulse shrink-0" />
      <Row class="flex-1 h-6 items-center gap-[2px] overflow-hidden">
        <span
          v-for="(lvl, i) in levels"
          :key="i"
          class="w-[3px] rounded-[1px] bg-metro-fg-light dark:bg-metro-fg-dark shrink-0"
          :style="{ height: `${Math.max(3, lvl * 24)}px`, opacity: 0.8 }"
        />
      </Row>
      <span class="text-sm tabular-nums font-sans text-metro-head-light dark:text-metro-head-dark shrink-0">
        {{ formatVoiceDuration(seconds * 1000) }}
      </span>
      <Pressable
        tag="button"
        type="button"
        class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center
          text-metro-err hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        title="Cancel recording"
        @click="emit('cancel')"
      >
        <Icon name="trash" :size="20" />
      </Pressable>
      <Button
        variant="primary"
        size="md"
        pill
        :tint-bg="palette.primary"
        :tint-fg="palette.bg"
        title="Send voice note"
        @click="emit('send')"
      >
        <Icon name="arrowSmUp" :size="20" :color="palette.bg" />
      </Button>
    </Row>
  </Col>
</template>
