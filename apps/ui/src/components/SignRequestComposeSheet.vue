<script setup lang="ts">

import { ref, computed } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';

const palette = useKitPalette();

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
  <!-- kit-exception: fixed modal overlay backdrop — kit has no overlay/Dialog
       primitive; rendered as a fixed positioned Col with a click-to-dismiss scrim.
       Mirrors PollComposeSheet + mobile SignatureSheet (MessengerComposer.sheets). -->
  <Col class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    @click.self="emit('close')">
    <Col class="absolute inset-0 bg-black/50" @click="emit('close')" />
    <Col surface="raised"
      class="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto no-scrollbar
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

      <Row class="flex items-center gap-2">
        <Pressable tag="button" type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm text-center font-head
            border border-metro-border-light dark:border-metro-border-dark"
          :class="kind === 'personal'
            ? 'bg-metro-link-light dark:bg-metro-link-dark text-white'
            : 'text-metro-fg-light dark:text-metro-fg-dark'"
          @click="kind = 'personal'">Message</Pressable>
        <Pressable tag="button" type="button"
          class="flex-1 rounded-lg px-3 py-2 text-sm text-center font-head
            border border-metro-border-light dark:border-metro-border-dark"
          :class="kind === 'eip712'
            ? 'bg-metro-link-light dark:bg-metro-link-dark text-white'
            : 'text-metro-fg-light dark:text-metro-fg-dark'"
          @click="kind = 'eip712'">Typed data</Pressable>
      </Row>

      <!-- kit-exception: bare inputs — kit Input/Textarea force boxed styling that
           clashes with this surface; mirrors PollComposeSheet + mobile fields. -->
      <component :is="'input'"
        :value="desc"
        @input="desc = ($event.target as HTMLInputElement).value"
        placeholder="Description (e.g. Sign in to dapp)"
        class="w-full rounded-lg px-3 py-2 font-sans text-[15px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

      <component v-if="kind === 'personal'" :is="'textarea'"
        :value="message"
        @input="message = ($event.target as HTMLTextAreaElement).value"
        placeholder="Message to sign"
        rows="4"
        class="w-full resize-none rounded-lg px-3 py-2 font-sans text-[15px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

      <component v-else :is="'textarea'"
        :value="json"
        @input="json = ($event.target as HTMLTextAreaElement).value"
        :placeholder="eip712Placeholder"
        rows="8"
        spellcheck="false"
        class="w-full resize-none rounded-lg px-3 py-2 font-mono text-[13px] outline-none
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
