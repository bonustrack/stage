<script setup lang="ts">
import KitNode from './KitNode.vue';
import type { ParagraphNode } from '../kit';

defineProps<{ node?: ParagraphNode }>();
</script>

<template>
  <div class="kit-paragraph">
    <template v-if="node">
      <KitNode v-for="(c, i) in node.children" :key="i" :node="c" />
    </template>
    <slot v-else />
  </div>
</template>

<style scoped>
.kit-paragraph {
  display: block;
}
.kit-paragraph :deep(p) {
  display: inline;
}
</style>
