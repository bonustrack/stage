<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [string]; close: [] }>();

const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => { inputRef.value?.focus(); });

function onInput(e: Event): void { emit('update:modelValue', (e.target as HTMLInputElement).value); }
function setQuery(v: string): void { emit('update:modelValue', v); }
</script>

<template>
  <Row
    align="center"
    :gap="10"
    class="h-[52px] box-border px-4
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
  >
    <Pressable tag="button" type="button" title="Close search" @click="emit('close')">
      <Icon name="arrowLeft" :size="22" class="text-metro-head-light dark:text-metro-head-dark" />
    </Pressable>
    <!-- kit-exception: borderless transparent search field matching mobile SearchTopnavBar -->
    <component
      :is="'input'"
      ref="inputRef"
      type="text"
      :value="props.modelValue"
      :placeholder="props.placeholder ?? 'Search'"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      class="flex-1 min-w-0 bg-transparent border-0 outline-none p-0 text-[19px] font-sans
        text-metro-head-light dark:text-metro-head-dark
        placeholder:text-metro-sub-light dark:placeholder:text-metro-sub-dark"
      @input="onInput"
    />
    <Pressable
      v-if="props.modelValue.length > 0"
      tag="button"
      type="button"
      title="Clear search"
      @click="setQuery('')"
    >
      <Icon name="x" :size="18" class="text-metro-sub-light dark:text-metro-sub-dark" />
    </Pressable>
  </Row>
</template>
