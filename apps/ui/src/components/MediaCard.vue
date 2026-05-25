<script setup lang="ts">
/** Rounded, bordered "media bubble" wrapper. Vue counterpart to
 *  apps/app/components/MediaCard.tsx. Wraps shared attachments so image /
 *  video / map / YouTube thumbnails all read as discrete cards. */

const props = defineProps<{ onPress?: () => void; width?: number }>();
</script>

<template>
  <component
    :is="props.onPress ? 'button' : 'div'"
    :type="props.onPress ? 'button' : undefined"
    :style="props.width ? { width: props.width + 'px' } : undefined"
    :class="[
      'block max-w-[280px] rounded-2xl border overflow-hidden mb-1.5',
      'border-metro-border-light dark:border-metro-border-dark',
      'bg-metro-surface-light dark:bg-metro-surface-dark',
      props.onPress ? 'cursor-pointer hover:opacity-90 transition-opacity text-left' : '',
    ]"
    @click="props.onPress?.()"
  >
    <slot />
  </component>
</template>
