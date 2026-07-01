<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  openNonce?: number;
  accept?: string;
  multiple?: boolean;
  capture?: 'user' | 'environment';
}>();

const emit = defineEmits<{
  pick: [files: File[]];
  cancel: [];
}>();

const input = ref<HTMLInputElement | null>(null);

watch(
  () => props.openNonce,
  (next, prev) => {
    if (next === undefined || next === prev) return;
    input.value?.click();
  },
);

function onChange(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  const files = el.files ? Array.from(el.files) : [];
  el.value = '';
  if (files.length > 0) emit('pick', files);
  else emit('cancel');
}
</script>

<template>
  <!-- kit-exception: native file input — kit Input has no 'file' inputType;
       rendered via dynamic tag to keep bare <input> semantics. -->
  <component
    :is="'input'"
    ref="input"
    type="file"
    :accept="accept"
    :multiple="multiple"
    :capture="capture"
    style="display: none"
    @change="onChange"
  />
</template>
