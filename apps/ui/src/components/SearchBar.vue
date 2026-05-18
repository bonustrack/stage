<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<template>
  <div class="px-4 py-2 border-b border-metro-border-light dark:border-metro-border-dark
    flex items-center gap-2 bg-metro-bg-light dark:bg-metro-bg-dark">
    <input
      type="text"
      :value="modelValue"
      placeholder="Search messages, senders, lines…"
      autocorrect="off"
      autocapitalize="none"
      spellcheck="false"
      class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark rounded-md px-3 py-2 text-sm outline-none
        focus:ring-2 focus:ring-metro-accent"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="text-sm font-semibold text-metro-accent hover:underline"
      @click="$emit('update:modelValue', '')"
    >Clear</button>
  </div>
</template>
