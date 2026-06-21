<script setup lang="ts">

const props = defineProps<{
  status: 'idle' | 'resolving' | 'resolved' | 'missed';
  address: string | null;
  query: string;
}>();
const emit = defineEmits<(e: 'open') => void>();
</script>

<template>
  <Pressable
    tag="button"
    v-if="props.status === 'resolved' && props.address"
    type="button"
    class="mx-3 mb-2 px-3 py-2 rounded-lg
      bg-metro-head-light dark:bg-metro-head-dark
      text-metro-bg-light dark:text-metro-bg-dark
      text-sm text-left hover:opacity-90 block"
    @click="emit('open')"
  >
    Open profile of {{ props.address.slice(0, 6) }}…{{ props.address.slice(-4) }}
  </Pressable>
  <Col v-else-if="props.status === 'resolving'"
    class="mx-3 mb-2 px-3 py-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
    Resolving…
  </Col>
  <Col v-else-if="props.status === 'missed'"
    class="mx-3 mb-2 px-3 py-2 text-xs text-metro-sub-light dark:text-metro-sub-dark">
    No address found for "{{ props.query }}"
  </Col>
</template>
