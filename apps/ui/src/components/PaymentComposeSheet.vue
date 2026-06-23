<script setup lang="ts">

import { ref, computed } from 'vue';
import { isAddress } from 'viem';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';

const palette = useKitPalette();

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
  <!-- kit-exception: fixed modal overlay backdrop — kit has no overlay/Dialog
       primitive; rendered as a fixed positioned Col with a click-to-dismiss scrim.
       Mirrors PollComposeSheet + mobile PaymentSheet (MessengerComposer.sheets). -->
  <Col class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    @click.self="emit('close')">
    <Col class="absolute inset-0 bg-black/50" @click="emit('close')" />
    <Col surface="raised"
      class="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto no-scrollbar
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

      <!-- kit-exception: bare inputs — kit Input/Textarea force boxed styling that
           clashes with this surface; mirrors PollComposeSheet + mobile fields. -->
      <component :is="'input'"
        :value="to"
        @input="to = ($event.target as HTMLInputElement).value"
        placeholder="Recipient address (0x…)"
        autocapitalize="none" autocomplete="off" spellcheck="false"
        class="w-full rounded-lg px-3 py-2 font-sans text-[16px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

      <component :is="'input'"
        :value="amount"
        @input="amount = ($event.target as HTMLInputElement).value"
        placeholder="Amount (ETH)"
        inputmode="decimal"
        class="w-full rounded-lg px-3 py-2 font-sans text-[16px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

      <component :is="'input'"
        :value="note"
        @input="note = ($event.target as HTMLInputElement).value"
        placeholder="Note (optional)"
        class="w-full rounded-lg px-3 py-2 font-sans text-[15px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

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
  </Col>
</template>
