<script setup lang="ts">

import { ref, computed } from 'vue';
import { isAddress } from 'viem';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { composeField } from '@/lib/composeField';
import { basicRoot } from '@/lib/kitRow';

const palette = useKitPalette();

const TO_CHANGE = 'payment.to.change';
const AMOUNT_CHANGE = 'payment.amount.change';
const NOTE_CHANGE = 'payment.note.change';

const toNode = computed(() =>
  basicRoot(composeField({
    name: 'to',
    value: to.value,
    placeholder: 'Recipient address (0x…)',
    fontSize: 16,
    autoCapitalize: 'none',
    autoCorrect: false,
    changeType: TO_CHANGE,
  })));

const amountNode = computed(() =>
  basicRoot(composeField({
    name: 'amount',
    value: amount.value,
    placeholder: 'Amount (ETH)',
    fontSize: 16,
    inputMode: 'decimal',
    changeType: AMOUNT_CHANGE,
  })));

const noteNode = computed(() =>
  basicRoot(composeField({
    name: 'note',
    value: note.value,
    placeholder: 'Note (optional)',
    fontSize: 15,
    changeType: NOTE_CHANGE,
  })));

const registry: WidgetActionRegistry = {
  [TO_CHANGE]: (action) => {
    const next = action.payload.to;
    if (typeof next === 'string') to.value = next;
  },
  [AMOUNT_CHANGE]: (action) => {
    const next = action.payload.amount;
    if (typeof next === 'string') amount.value = next;
  },
  [NOTE_CHANGE]: (action) => {
    const next = action.payload.note;
    if (typeof next === 'string') note.value = next;
  },
};

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload: { to: string; amount: string; note: string }): void;
}>();

const to = ref('');
const amount = ref('');
const note = ref('');

const canCreate = computed(() => {
  const n = Number(amount.value.trim());
  return isAddress(to.value.trim()) && Number.isFinite(n) && n > 0;
});

function create(): void {
  if (!canCreate.value) return;
  emit('create', { to: to.value.trim(), amount: amount.value.trim(), note: note.value.trim() });
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
          class="text-metro-head-light dark:text-metro-head-dark">Request payment</Text>
        <Pressable tag="button" type="button" class="opacity-70 hover:opacity-100"
          @click="emit('close')">
          <Icon name="x" :size="18" />
        </Pressable>
      </Row>

      <KitRenderer :node="toNode" :registry="registry" />
      <KitRenderer :node="amountNode" :registry="registry" />
      <KitRenderer :node="noteNode" :registry="registry" />

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
