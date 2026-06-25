<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';

const props = withDefaults(
  defineProps<{
    padding?: number;
    gap?: number;
    horizontal?: boolean;
    stickToBottom?: boolean;
    atBottomThreshold?: number;
    scrollToNonce?: number;
    scrollToId?: string;
    fillAbsolute?: boolean;
    hideScrollbar?: boolean;
  }>(),
  { horizontal: false, stickToBottom: false, atBottomThreshold: 64, fillAbsolute: false, hideScrollbar: false },
);

const el = ref<HTMLDivElement | null>(null);
let observer: MutationObserver | null = null;
let consumedNonce: number | undefined;

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: props.horizontal ? 'row' : 'column',
    overflowX: props.horizontal ? 'auto' : 'hidden',
    overflowY: props.horizontal ? 'hidden' : 'auto',
  };
  if (props.padding !== undefined) css.padding = `${props.padding}px`;
  if (props.gap !== undefined) css.gap = `${props.gap}px`;
  if (props.fillAbsolute) {
    css.position = 'absolute';
    css.top = '0';
    css.right = '0';
    css.bottom = '0';
    css.left = '0';
  }
  if (props.hideScrollbar) css.scrollbarWidth = 'none';
  return css;
});

function scrollToBottom(): void {
  const node = el.value;
  if (node) node.scrollTop = node.scrollHeight;
}

function scrollChildIntoView(): boolean {
  const node = el.value;
  const id = props.scrollToId;
  if (!node || !id) return false;
  const child = node.querySelector(`#${CSS.escape(id)}`);
  if (!(child instanceof HTMLElement)) return false;
  child.scrollIntoView({ block: 'center' });
  return true;
}

function settle(): void {
  void nextTick(() => {
    const nonce = props.scrollToNonce;
    if (nonce !== undefined && nonce !== consumedNonce && props.scrollToId) {
      if (scrollChildIntoView()) {
        consumedNonce = nonce;
        return;
      }
      return;
    }
    if (props.stickToBottom) scrollToBottom();
  });
}

onMounted(() => {
  settle();
  if (el.value) {
    observer = new MutationObserver(() => { settle(); });
    observer.observe(el.value, { childList: true, subtree: true, characterData: true });
  }
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

watch(
  () => props.scrollToNonce,
  (nonce, prev) => {
    if (nonce === undefined || nonce === prev) return;
    void nextTick(() => {
      if (props.scrollToId && scrollChildIntoView()) consumedNonce = nonce;
    });
  },
);
</script>

<template>
  <div ref="el" :style="style" :class="{ 'kit-scroll-no-bar': hideScrollbar }">
    <slot />
  </div>
</template>

<style scoped>
.kit-scroll-no-bar::-webkit-scrollbar { display: none; }
</style>
