<script setup lang="ts">
import { ref } from 'vue';
import KitNode from './KitNode.vue';
import Col from './Col.vue';
import Pressable from './Pressable.vue';
import Icon from './Icon.vue';
import {
  dispatchAction,
  type PopoverItem,
  type WidgetNode,
} from '../kit';
import { resolveIconName } from './kit-node-props';
import { useKitRender } from './kit-form-context';

const POPOVER_ITEM_PRESS = 'popover.item.press';

defineProps<{
  trigger: WidgetNode;
  items: PopoverItem[];
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}>();

const render = useKitRender();
const open = ref(false);

function close(): void {
  open.value = false;
}

function run(item: PopoverItem): void {
  open.value = false;
  if (item.disabled === true) return;
  const type = item.pressType ?? POPOVER_ITEM_PRESS;
  void dispatchAction(render.registry, { type, payload: item.payload }, {
    id: item.id,
  });
}
</script>

<template>
  <Pressable tag="button" type="button" @click="open = true">
    <KitNode :node="trigger" />
  </Pressable>

  <template v-if="open">
    <Col class="fixed inset-0 z-40" @click="close" />
    <Col
      class="fixed z-50 min-w-[200px] py-1 rounded-lg shadow-lg
        bg-metro-bg-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      :class="[
        side === 'top' ? 'bottom-[52px]' : 'top-[52px]',
        align === 'start' ? 'left-2' : 'right-2',
      ]"
    >
      <Pressable
        v-for="item in items"
        :key="item.id"
        tag="button"
        type="button"
        :disabled="item.disabled"
        class="w-full flex items-center gap-3 text-left px-3 py-2.5 text-sm disabled:opacity-50
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        :class="item.danger
          ? 'text-red-500'
          : 'text-metro-head-light dark:text-metro-head-dark'"
        @click="run(item)"
      >
        <Icon v-if="item.icon" :name="resolveIconName(item.icon)" :size="20" />
        {{ item.label }}
      </Pressable>
    </Col>
  </template>
</template>
