<script setup lang="ts">
/** Bottom tab bar — Channels / Contacts / Settings / Profile.
 *  Mirrors apps/app/app/(tabs)/_layout.tsx (icons-only, no labels). */

import type { HeroIconName } from './HeroIcon.vue';

const TABS: { to: string; label: string; icon: HeroIconName }[] = [
  { to: '/channels', label: 'Channels', icon: 'send' },
  { to: '/contacts', label: 'Contacts', icon: 'users' },
  { to: '/settings', label: 'Settings', icon: 'cog' },
  { to: '/profile',  label: 'Profile',  icon: 'user' },
];
</script>

<template>
  <nav class="border-t border-metro-border-light dark:border-metro-border-dark
    bg-metro-bg-light dark:bg-metro-bg-dark
    flex items-center justify-around py-1.5
    safe-area-bottom">
    <RouterLink
      v-for="tab in TABS"
      :key="tab.to"
      :to="tab.to"
      :aria-label="tab.label"
      class="flex items-center justify-center px-5 py-2 transition-colors
        text-metro-sub-light dark:text-metro-sub-dark
        hover:text-metro-head-light dark:hover:text-metro-head-dark"
      active-class="!text-metro-head-light dark:!text-metro-head-dark"
    >
      <HeroIcon :name="tab.icon" :size="24" />
    </RouterLink>
  </nav>
</template>

<style scoped>
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
</style>
