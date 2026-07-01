<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import KitNode from './KitNode.vue';
import type { ScrollNode } from '../kit';

const props = defineProps<{ node: ScrollNode }>();

function spacing(value: ScrollNode['padding']): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `${value}px`;
  if (typeof value === 'string') return value;
  const y = value.y ?? value.top ?? 0;
  const x = value.x ?? value.left ?? 0;
  return `${typeof y === 'number' ? `${y}px` : y} ${typeof x === 'number' ? `${x}px` : x}`;
}

const el = ref<HTMLDivElement | null>(null);
let observer: MutationObserver | null = null;
let consumedNonce: number | undefined;

const style = computed<Record<string, string>>(() => {
  const css: Record<string, string> = {
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'hidden',
    overflowY: 'auto',
  };
  if (props.node.gap !== undefined) {
    css.gap = typeof props.node.gap === 'number' ? `${props.node.gap}px` : props.node.gap;
  }
  const pad = spacing(props.node.padding);
  if (pad !== undefined) css.padding = pad;
  if (props.node.fillAbsolute) {
    css.position = 'absolute';
    css.top = '0';
    css.right = '0';
    css.bottom = '0';
    css.left = '0';
  }
  if (props.node.hideScrollbar) css.scrollbarWidth = 'none';
  return css;
});

function scrollToBottom(): void {
  const node = el.value;
  if (node) node.scrollTop = node.scrollHeight;
}

function scrollChildIntoView(): boolean {
  const node = el.value;
  const id = props.node.scrollToId;
  if (!node || !id) return false;
  const child = node.querySelector(`#${CSS.escape(id)}`);
  if (!(child instanceof HTMLElement)) return false;
  child.scrollIntoView({ block: 'center' });
  return true;
}

function settle(): void {
  void nextTick(() => {
    const nonce = props.node.scrollToNonce;
    if (nonce !== undefined && nonce !== consumedNonce && props.node.scrollToId) {
      if (scrollChildIntoView()) consumedNonce = nonce;
      return;
    }
    if (props.node.stickToBottom) scrollToBottom();
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
  () => props.node.scrollToNonce,
  (nonce, prev) => {
    if (nonce === undefined || nonce === prev) return;
    void nextTick(() => {
      if (props.node.scrollToId && scrollChildIntoView()) consumedNonce = nonce;
    });
  },
);
</script>

<template>
  <div ref="el" :style="style" :class="{ 'kit-scroll-no-bar': node.hideScrollbar }">
    <KitNode v-for="(c, i) in node.children" :key="i" :node="c" />
  </div>
</template>

<style scoped>
.kit-scroll-no-bar::-webkit-scrollbar { display: none; }
</style>
