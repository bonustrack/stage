<script setup lang="ts">
import { computed } from 'vue';
import Image from './Image.vue';
import { AVATAR_SIZES, type AvatarSize } from '../avatar';

const props = withDefaults(
  defineProps<{
    src?: string | null;
    size?: AvatarSize | number;
    square?: boolean;
    alt?: string;
    placeholderColor?: string;
  }>(),
  { size: 'md', placeholderColor: '#282a2d' },
);

const px = computed(() => (typeof props.size === 'number' ? props.size : AVATAR_SIZES[props.size]));

const radius = computed(() => (props.square ? Math.round(px.value * 0.12) : 999));

const hasSrc = computed(() => Boolean(props.src?.trim()));

const boxStyle = computed<Record<string, string>>(() => ({
  width: `${px.value}px`,
  height: `${px.value}px`,
  borderRadius: `${radius.value}px`,
  backgroundColor: props.placeholderColor,
}));
</script>

<template>
  <Image
    v-if="hasSrc"
    :src="src as string"
    :alt="alt"
    :size="px"
    :radius="radius"
    :background="placeholderColor"
  />
  <div v-else :style="boxStyle" />
</template>
