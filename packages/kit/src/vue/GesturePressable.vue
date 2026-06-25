<script setup lang="ts">
import { ref } from 'vue';
import type { SwipeDirection } from '../kit';

const props = defineProps<{
  clickable?: boolean;
  longPressable?: boolean;
  swipeable?: boolean;
}>();

const emit = defineEmits<{
  press: [];
  longpress: [];
  swipe: [direction: SwipeDirection];
}>();

const SWIPE_THRESHOLD = 40;
const LONG_PRESS_MS = 350;

const startX = ref(0);
const startY = ref(0);
const moved = ref(false);
const longFired = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
}

function onPointerDown(event: PointerEvent): void {
  startX.value = event.clientX;
  startY.value = event.clientY;
  moved.value = false;
  longFired.value = false;
  if (props.longPressable) {
    timer = setTimeout(() => {
      longFired.value = true;
      emit('longpress');
    }, LONG_PRESS_MS);
  }
}

function pickDirection(dx: number, dy: number): SwipeDirection | undefined {
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function onPointerUp(event: PointerEvent): void {
  clearTimer();
  const dx = event.clientX - startX.value;
  const dy = event.clientY - startY.value;
  const dir = pickDirection(dx, dy);
  if (props.swipeable && dir) {
    emit('swipe', dir);
    return;
  }
  if (longFired.value) return;
  if (props.clickable && !moved.value) emit('press');
}

function onPointerMove(event: PointerEvent): void {
  const dx = Math.abs(event.clientX - startX.value);
  const dy = Math.abs(event.clientY - startY.value);
  if (dx > 6 || dy > 6) {
    moved.value = true;
    clearTimer();
  }
}
</script>

<template>
  <div
    :style="{ touchAction: swipeable ? 'pan-y' : 'auto' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="clearTimer"
    @pointerleave="clearTimer"
  >
    <slot />
  </div>
</template>
