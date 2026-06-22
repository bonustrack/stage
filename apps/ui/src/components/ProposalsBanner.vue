<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useProposalCount } from '../lib/useProposals';

const router = useRouter();
const palette = useKitPalette();
const { count } = useProposalCount();

function open(): void { void router.push('/proposals'); }
</script>

<template>
  <Pressable
    v-if="count > 0"
    tag="button"
    type="button"
    class="w-full shrink-0 flex items-center gap-2.5 px-4 py-3
      border-b border-metro-border-light dark:border-metro-border-dark
      hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark text-left"
    @click="open"
  >
    <Icon name="statusOnline" :size="20" :color="palette.link" />
    <Text size="lg" weight="semibold" color="link" class="flex-1">
      {{ count === 1 ? '1 pending request' : `${count} pending requests` }}
    </Text>
    <Icon name="chevronRight" :size="18" :color="palette.text" />
  </Pressable>
</template>
