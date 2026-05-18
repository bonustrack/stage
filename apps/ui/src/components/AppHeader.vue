<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{
  status?: string;
  errorMsg?: string | null;
  count?: number;
  chat?: string;
  filterActive?: boolean;
}>();
defineEmits<{ (e: 'clearChat'): void; (e: 'filter'): void }>();

function shortLine(line: string): string {
  return line.replace(/^metro:\/\//, '');
}
</script>

<template>
  <header class="border-b border-metro-border-light dark:border-metro-border-dark">
    <div class="flex items-center gap-3 px-4 py-2">
      <span
        class="inline-block w-2 h-2 rounded-full"
        :class="status === 'open'
          ? 'bg-metro-ok'
          : status === 'connecting'
            ? 'bg-metro-warn'
            : status
              ? 'bg-metro-err'
              : 'bg-metro-sub-light dark:bg-metro-sub-dark'"
      />
      <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark">
        {{ status || 'idle' }}<template v-if="errorMsg"> · {{ errorMsg }}</template>
        <template v-if="count !== undefined"> · {{ count }} event{{ count === 1 ? '' : 's' }}</template>
      </span>
      <div class="flex-1" />
      <button
        v-if="$slots.actions || filterActive !== undefined"
        type="button"
        class="text-sm font-semibold text-metro-accent hover:underline"
        :class="filterActive ? 'text-metro-ok font-bold' : ''"
        @click="$emit('filter')"
      >
        Filter{{ filterActive ? ' •' : '' }}
      </button>
      <RouterLink to="/lines" class="text-sm font-semibold text-metro-accent hover:underline">Lines</RouterLink>
      <RouterLink to="/settings" class="text-sm font-semibold text-metro-accent hover:underline">Settings</RouterLink>
    </div>
    <div
      v-if="chat"
      class="flex items-center gap-2 px-4 pb-2 text-xs text-metro-sub-light dark:text-metro-sub-dark"
    >
      <span class="truncate">filter: {{ shortLine(chat) }}</span>
      <button
        type="button"
        class="font-semibold text-metro-accent hover:underline"
        @click="$emit('clearChat')"
      >clear</button>
    </div>
  </header>
</template>
