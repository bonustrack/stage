<script setup lang="ts">

import { ref, computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { composeField } from '@/lib/composeField';
import { basicRoot } from '@/lib/kitRow';

const palette = useKitPalette();

const DESC_CHANGE = 'sign.desc.change';
const MESSAGE_CHANGE = 'sign.message.change';
const JSON_CHANGE = 'sign.json.change';

const descNode = computed(() =>
  basicRoot(composeField({
    name: 'desc',
    value: desc.value,
    placeholder: 'Description (e.g. Sign in to dapp)',
    fontSize: 15,
    changeType: DESC_CHANGE,
  })));

const messageNode = computed(() =>
  basicRoot(composeField({
    name: 'message',
    value: message.value,
    placeholder: 'Message to sign',
    fontSize: 15,
    multiline: true,
    rows: 4,
    changeType: MESSAGE_CHANGE,
  })));

const jsonNode = computed(() =>
  basicRoot(composeField({
    name: 'json',
    value: json.value,
    placeholder: eip712Placeholder,
    fontSize: 13,
    multiline: true,
    rows: 8,
    mono: true,
    autoCorrect: false,
    changeType: JSON_CHANGE,
  })));

const registry: WidgetActionRegistry = {
  [DESC_CHANGE]: (action) => {
    const next = action.payload.desc;
    if (typeof next === 'string') desc.value = next;
  },
  [MESSAGE_CHANGE]: (action) => {
    const next = action.payload.message;
    if (typeof next === 'string') message.value = next;
  },
  [JSON_CHANGE]: (action) => {
    const next = action.payload.json;
    if (typeof next === 'string') json.value = next;
  },
};

const tintBg = computed(() => {
  const hex = palette.primary.replace('#', '');
  if (hex.length !== 6) return 'rgba(192,160,110,0.15)';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.15)`;
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload:
    | { kind: 'personal'; message: string; description: string }
    | { kind: 'eip712'; json: string; description: string }): void;
}>();

const kind = ref<'personal' | 'eip712'>('personal');
const desc = ref('');
const message = ref('');
const json = ref('');

const eip712Placeholder = `{
  "domain": {},
  "types": { "Mail": [{ "name": "contents", "type": "string" }] },
  "primaryType": "Mail",
  "message": { "contents": "Hello" }
}`;

const canCreate = computed(() =>
  kind.value === 'personal' ? message.value.trim().length > 0 : json.value.trim().length > 0);

function create(): void {
  if (!canCreate.value) return;
  if (kind.value === 'personal') {
    emit('create', { kind: 'personal', message: message.value.trim(), description: desc.value.trim() });
  } else {
    emit('create', { kind: 'eip712', json: json.value.trim(), description: desc.value.trim() });
  }
}
</script>

<template>
  <Dialog open side="bottom" animation-type="slide"
    overlay-class="flex items-end sm:items-center justify-center"
    @close="emit('close')">
    <Col surface="raised"
      class="w-full sm:max-w-md max-h-[85vh] overflow-y-auto no-scrollbar
        rounded-t-2xl sm:rounded-2xl p-4 gap-3
        bg-metro-bg-light dark:bg-metro-bg-dark">
      <Row class="flex items-center justify-between">
        <Text size="lg" weight="semibold"
          class="text-metro-head-light dark:text-metro-head-dark">Request signature</Text>
        <Pressable tag="button" type="button" class="opacity-70 hover:opacity-100"
          @click="emit('close')">
          <Icon name="x" :size="18" />
        </Pressable>
      </Row>

      <!-- Active toggle tints with the brand accent (translucent fill + accent text),
           mirroring mobile SignatureSheet (#c0a06e). Avoids the link-on-link
           invisibility that a solid link bg + white text caused in dark mode. -->
      <Row class="flex items-center gap-2">
        <Pressable tag="button" type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm text-center font-head border"
          :style="kind === 'personal'
            ? { borderColor: palette.primary, backgroundColor: tintBg, color: palette.primary }
            : { borderColor: palette.border }"
          :class="kind === 'personal' ? '' : 'text-metro-fg-light dark:text-metro-fg-dark'"
          @click="kind = 'personal'">Message</Pressable>
        <Pressable tag="button" type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm text-center font-head border"
          :style="kind === 'eip712'
            ? { borderColor: palette.primary, backgroundColor: tintBg, color: palette.primary }
            : { borderColor: palette.border }"
          :class="kind === 'eip712' ? '' : 'text-metro-fg-light dark:text-metro-fg-dark'"
          @click="kind = 'eip712'">Typed data</Pressable>
      </Row>

      <KitRenderer :node="descNode" :registry="registry" />

      <KitRenderer v-if="kind === 'personal'" :node="messageNode" :registry="registry" />

      <KitRenderer v-else :node="jsonNode" :registry="registry" />

      <Button
        variant="primary"
        size="md"
        :tint-bg="palette.primary"
        :tint-fg="palette.bg"
        :disabled="!canCreate"
        title="Send request"
        @click="create"
      >
        Send request
      </Button>
    </Col>
  </Dialog>
</template>
