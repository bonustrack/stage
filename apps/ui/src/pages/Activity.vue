<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
onMounted(() => { void router; });
</script>

<template>
  <div class="p-6">
    <h1 class="text-xl font-bold">Activity</h1>
    <p class="text-metro-sub-light dark:text-metro-sub-dark">Coming next.</p>
  </div>
</template>
