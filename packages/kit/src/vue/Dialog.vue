<script setup lang="ts">
import { computed } from 'vue';
import KitNode from './KitNode.vue';
import { dispatchAction, resolveColor, type Color, type DialogNode } from '../kit';
import { useKitRender } from './kit-form-context';
import { useKitScheme } from './theme-context';

const props = defineProps<{
  node?: DialogNode;
  open?: boolean;
  side?: 'center' | 'bottom';
  backdrop?: boolean;
  backdropColor?: Color;
  dismissable?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  panelClass?: string;
  overlayClass?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const scheme = useKitScheme();
const render = useKitRender();

const isOpen = computed(() => props.node ? props.node.open : props.open ?? false);
const side = computed(() => props.node?.side ?? props.side ?? 'center');
const showBackdrop = computed(() => (props.node?.backdrop ?? props.backdrop ?? true));
const dismissable = computed(() => (props.node?.dismissable ?? props.dismissable ?? true));
const animation = computed(() => props.node?.animationType ?? props.animationType ?? 'fade');
const transitionName = computed(() =>
  animation.value === 'none' ? 'kit-dialog-none'
    : side.value === 'bottom' || animation.value === 'slide' ? 'kit-dialog-slide'
      : 'kit-dialog-fade');

const backdropBg = computed(() => {
  const c = props.node?.backdropColor ?? props.backdropColor;
  return c === undefined ? 'rgba(0,0,0,0.5)' : resolveColor(c, scheme);
});

const overlayStyle = computed<Record<string, string>>(() => {
  const base: Record<string, string> = {
    position: 'fixed',
    inset: '0',
    zIndex: '50',
    display: 'flex',
    flexDirection: 'column',
  };
  if (props.overlayClass === undefined) {
    base.alignItems = 'center';
    base.justifyContent = side.value === 'bottom' ? 'flex-end' : 'center';
  }
  return base;
});

function close(): void {
  if (!dismissable.value) return;
  emit('close');
  if (props.node?.onCloseAction === undefined) return;
  void dispatchAction(render.registry, props.node.onCloseAction);
}
</script>

<template>
  <Transition :name="transitionName">
    <div v-if="isOpen" :class="overlayClass" :style="overlayStyle">
      <div
        v-if="showBackdrop"
        :style="{ position: 'absolute', inset: '0', background: backdropBg }"
        @click="close"
      />
      <div :class="panelClass" :style="{ position: 'relative' }">
        <template v-if="node">
          <KitNode v-for="(c, i) in node.children" :key="i" :node="c" />
        </template>
        <slot v-else />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.kit-dialog-fade-enter-active,
.kit-dialog-fade-leave-active { transition: opacity 0.2s ease; }
.kit-dialog-fade-enter-from,
.kit-dialog-fade-leave-to { opacity: 0; }

.kit-dialog-slide-enter-active,
.kit-dialog-slide-leave-active { transition: opacity 0.25s ease; }
.kit-dialog-slide-enter-from,
.kit-dialog-slide-leave-to { opacity: 0; }
.kit-dialog-slide-enter-active > div:last-child,
.kit-dialog-slide-leave-active > div:last-child { transition: transform 0.25s ease; }
.kit-dialog-slide-enter-from > div:last-child,
.kit-dialog-slide-leave-to > div:last-child { transform: translateY(100%); }
</style>
