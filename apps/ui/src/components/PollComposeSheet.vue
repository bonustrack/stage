<script setup lang="ts">

import { ref, computed } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';

const palette = useKitPalette();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'create', payload: { question: string; options: string[]; multiSelect: boolean }): void;
}>();

const question = ref('');
const options = ref<string[]>(['', '']);
const multiSelect = ref(false);

const trimmedOptions = computed(() => options.value.map(o => o.trim()).filter(Boolean));
const canCreate = computed(() => question.value.trim().length > 0 && trimmedOptions.value.length >= 2);

function addOption(): void { options.value = [...options.value, '']; }
function removeOption(i: number): void {
  if (options.value.length <= 2) return;
  options.value = options.value.filter((_, idx) => idx !== i);
}
function setOption(i: number, value: string): void {
  options.value = options.value.map((o, idx) => (idx === i ? value : o));
}
function create(): void {
  if (!canCreate.value) return;
  emit('create', {
    question: question.value.trim(),
    options: trimmedOptions.value,
    multiSelect: multiSelect.value,
  });
}
</script>

<template>
  <!-- kit-exception: fixed modal overlay backdrop — kit has no overlay/Dialog
       primitive; rendered as a fixed positioned Col with a click-to-dismiss scrim. -->
  <Col class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    @click.self="emit('close')">
    <Col class="absolute inset-0 bg-black/50" @click="emit('close')" />
    <Col surface="raised"
      class="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto no-scrollbar
        rounded-t-2xl sm:rounded-2xl p-4 gap-3
        bg-metro-bg-light dark:bg-metro-bg-dark">
      <Row class="flex items-center justify-between">
        <Text size="lg" weight="semibold"
          class="text-metro-head-light dark:text-metro-head-dark">New poll</Text>
        <Pressable tag="button" type="button" class="opacity-70 hover:opacity-100"
          @click="emit('close')">
          <Icon name="x" :size="18" />
        </Pressable>
      </Row>

      <!-- kit-exception: bare inputs — kit Input/Textarea force boxed styling that
           clashes with this surface; mirrors mobile poll-compose sheet inputs. -->
      <component :is="'input'"
        :value="question"
        @input="question = ($event.target as HTMLInputElement).value"
        placeholder="Ask a question…"
        class="w-full rounded-lg px-3 py-2 font-sans text-[16px] outline-none
          border border-metro-border-light dark:border-metro-border-dark
          bg-metro-surface-light dark:bg-metro-surface-dark
          text-metro-head-light dark:text-metro-head-dark
          placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark" />

      <Col class="gap-2">
        <Row v-for="(opt, i) in options" :key="i" class="flex items-center gap-2">
          <component :is="'input'"
            :value="opt"
            :placeholder="`Option ${i + 1}`"
            class="flex-1 rounded-lg px-3 py-2 font-sans text-[15px] outline-none
              border border-metro-border-light dark:border-metro-border-dark
              bg-metro-surface-light dark:bg-metro-surface-dark
              text-metro-head-light dark:text-metro-head-dark
              placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
            @input="setOption(i, ($event.target as HTMLInputElement).value)" />
          <Pressable tag="button" type="button"
            v-if="options.length > 2"
            class="shrink-0 opacity-60 hover:opacity-100" title="Remove option"
            @click="removeOption(i)">
            <Icon name="x" :size="16" />
          </Pressable>
        </Row>
        <Pressable tag="button" type="button"
          class="self-start text-sm text-metro-link-light dark:text-metro-link-dark hover:underline"
          @click="addOption">+ Add option</Pressable>
      </Col>

      <Row class="flex items-center gap-2">
        <Pressable tag="button" type="button"
          class="flex items-center gap-2 text-sm text-metro-fg-light dark:text-metro-fg-dark"
          @click="multiSelect = !multiSelect">
          <Col class="w-4 h-4 rounded border flex items-center justify-center
              border-metro-border-light dark:border-metro-border-dark"
            :class="multiSelect ? 'bg-metro-link-light dark:bg-metro-link-dark' : ''">
            <Icon v-if="multiSelect" name="check" :size="12" :color="palette.bg" />
          </Col>
          Allow multiple answers
        </Pressable>
      </Row>

      <Button
        variant="primary"
        size="md"
        :tint-bg="palette.primary"
        :tint-fg="palette.bg"
        :disabled="!canCreate"
        title="Create poll"
        @click="create"
      >
        Create poll
      </Button>
    </Col>
  </Col>
</template>
