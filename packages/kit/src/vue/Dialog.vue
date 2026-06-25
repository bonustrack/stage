<script setup lang="ts">
import { computed } from 'vue';
import KitNode from './KitNode.vue';
import { dispatchAction, type DialogNode } from '../kit';
import { useKitRender } from './kit-form-context';

const props = defineProps<{ node: DialogNode }>();

const render = useKitRender();

const dismissable = computed(() => props.node.dismissable !== false);

const overlayStyle = computed<Record<string, string>>(() => ({
  position: 'fixed',
  inset: '0',
  zIndex: '50',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: props.node.side === 'bottom' ? 'flex-end' : 'center',
}));

function close(): void {
  if (!dismissable.value) return;
  if (props.node.onCloseAction === undefined) return;
  void dispatchAction(render.registry, props.node.onCloseAction);
}
</script>

<template>
  <div v-if="node.open" :style="overlayStyle">
    <div
      v-if="node.backdrop !== false"
      :style="{ position: 'absolute', inset: '0', background: 'rgba(0,0,0,0.5)' }"
      @click="close"
    />
    <div :style="{ position: 'relative' }">
      <KitNode v-for="(c, i) in node.children" :key="i" :node="c" />
    </div>
  </div>
</template>
