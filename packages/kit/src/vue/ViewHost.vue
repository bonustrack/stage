<script setup lang="ts">
import { computed } from 'vue';
import KitRenderer from './KitRenderer.vue';
import {
  payloadRegistry,
  type PayloadHandlers,
  type WidgetDataContext,
  type WidgetRoot,
} from '../kit';

const props = defineProps<{
  node: WidgetRoot;
  actions?: PayloadHandlers;
  data?: WidgetDataContext;
}>();

const registry = computed(() => payloadRegistry(props.actions ?? {}));
</script>

<template>
  <KitRenderer :node="node" :registry="registry" :data="data" />
</template>
