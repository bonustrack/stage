<script setup lang="ts">
defineProps<{
  status?: string;
  errorMsg?: string | null;
  count?: number;
  chat?: string;
  filterActive?: boolean;
}>();
defineEmits<{ (e: 'clearChat'): void; (e: 'filter'): void }>();

/** Twitter-style hide-on-scroll, mirrors App.vue's TabBar logic. */
const visible = ref(true);
let lastY = 0;
function onScroll(): void {
  const y = window.scrollY;
  if (y < 4) { visible.value = true; lastY = y; return; }
  const delta = y - lastY;
  if (Math.abs(delta) < 6) return;
  visible.value = delta < 0;
  lastY = y;
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header
    class="sticky top-0 z-20 transition-transform duration-200
      bg-metro-bg-light dark:bg-metro-bg-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
    :class="visible ? 'translate-y-0' : '-translate-y-full'"
  >
    <div class="flex items-center gap-3 px-4 py-2">
      <span
        class="inline-block w-2 h-2 rounded-full"
        :class="status === 'open' ? 'bg-metro-ok'
          : status === 'connecting' ? 'bg-metro-warn'
            : status ? 'bg-metro-err'
              : 'bg-metro-sub-light dark:bg-metro-sub-dark'"
      />
      <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark">
        {{ status || 'idle' }}<template v-if="errorMsg"> · {{ errorMsg }}</template>
        <template v-if="count !== undefined"> · {{ count }} event{{ count === 1 ? '' : 's' }}</template>
      </span>
      <div class="flex-1" />
      <button
        v-if="filterActive !== undefined"
        type="button"
        title="Filter"
        class="relative text-metro-fg-light dark:text-metro-fg-dark"
        :class="filterActive ? 'text-metro-ok' : ''"
        @click="$emit('filter')"
      >
        <HeroIcon name="filter" :size="20" />
        <span
          v-if="filterActive"
          class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-metro-ok"
        />
      </button>
    </div>
    <div v-if="chat" class="flex items-center gap-2 px-4 pb-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
      <span class="truncate">filter: {{ chat.replace(/^metro:\/\//, '') }}</span>
      <button type="button" class="font-semibold text-metro-accent hover:underline" @click="$emit('clearChat')">clear</button>
    </div>
  </header>
</template>
