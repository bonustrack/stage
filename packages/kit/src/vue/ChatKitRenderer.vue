<script setup lang="ts">
import { computed, reactive } from 'vue';
import Card from './Card.vue';
import Col from './Col.vue';
import ListView from './ListView.vue';
import ChatKitNode from './ChatKitNode.vue';
import { useKitScheme } from './theme-context';
import {
  dispatchAction,
  resolveBindings,
  type WidgetActionRegistry,
  type WidgetDataContext,
  type WidgetNode,
  type WidgetRoot,
} from '../chatkit';
import { cardProps } from './chatkit-node-props';
import {
  provideChatKitForm,
  provideChatKitRender,
} from './chatkit-form-context';

const props = defineProps<{
  node: WidgetRoot;
  registry?: WidgetActionRegistry;
  data?: WidgetDataContext;
}>();

const scheme = useKitScheme();
const registry = computed<WidgetActionRegistry>(() => props.registry ?? {});
const data = computed<WidgetDataContext>(() => props.data ?? {});

const resolved = computed<WidgetRoot>(() =>
  resolveBindings(props.node, data.value),
);

provideChatKitRender({
  get registry() {
    return registry.value;
  },
  get data() {
    return data.value;
  },
  get scheme() {
    return scheme;
  },
});

const formValues = reactive<Record<string, unknown>>({});

provideChatKitForm({
  setValue(name, value) {
    formValues[name] = value;
  },
  getValues() {
    return { ...formValues };
  },
});

const childNodes = computed<WidgetNode[]>(() => {
  const root = resolved.value;
  if (root.type === 'Basic') {
    if (root.children === undefined) return [];
    return Array.isArray(root.children) ? root.children : [root.children];
  }
  return root.children;
});

const card = computed(() =>
  resolved.value.type === 'Card' ? resolved.value : undefined,
);

const listView = computed(() =>
  resolved.value.type === 'ListView' ? resolved.value : undefined,
);

function confirmCard(): void {
  if (card.value?.confirm === undefined) return;
  void dispatchAction(registry.value, card.value.confirm.action, {
    ...formValues,
  });
}

function cancelCard(): void {
  if (card.value?.cancel === undefined) return;
  void dispatchAction(registry.value, card.value.cancel.action);
}
</script>

<template>
  <Card
    v-if="card"
    v-bind="cardProps(card, scheme)"
    @confirm="confirmCard"
    @cancel="cancelCard"
  >
    <ChatKitNode v-for="(c, i) in childNodes" :key="i" :node="c" />
  </Card>

  <ListView
    v-else-if="listView"
    :items="childNodes"
    :limit="typeof listView.limit === 'number' ? listView.limit : undefined"
    :status="listView.status ? { text: listView.status.text } : undefined"
    :dark="listView.theme === 'dark' ? true : undefined"
  >
    <template #item="{ item }">
      <ChatKitNode :node="item" />
    </template>
  </ListView>

  <Col v-else>
    <ChatKitNode v-for="(c, i) in childNodes" :key="i" :node="c" />
  </Col>
</template>
