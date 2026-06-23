<script setup lang="ts">

import type { HeroIconName } from '@stage-labs/kit/icons';


const TABS: { to: string; label: string; icon: HeroIconName }[] = [
  { to: '/channels', label: 'Channels', icon: 'chatBubble' },
  { to: '/contacts', label: 'Contacts', icon: 'users' },
  { to: '/wallet',   label: 'Wallet',   icon: 'wallet' },
];
</script>

<template>
  <Row tag="nav" align="center" justify="around" class="border-t border-metro-border-light dark:border-metro-border-dark
    bg-metro-bg-light dark:bg-metro-bg-dark
    pt-1.5
    safe-area-bottom">
    <RouterLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-label="tab.label"
      class="flex items-center justify-center px-5 h-[54px] transition-colors
        text-metro-fg-light dark:text-metro-fg-dark
        hover:text-metro-head-light dark:hover:text-metro-head-dark"
      active-class="!text-metro-link-light dark:!text-metro-link-dark"
    >
      <Icon :name="tab.icon" :size="26" />
    </RouterLink>
  </Row>
</template>

<style scoped>
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
</style>
