<script setup lang="ts">
/** Bottom tab bar — Home / Search / Lines / Settings. Mirrors apps/app/(tabs)/_layout.tsx. */

/** Order matches apps/app/(tabs)/_layout.tsx — Messenger ships last. */
const TABS = [
  { to: '/',          label: 'Home',      icon: 'home' as const   },
  { to: '/search',    label: 'Search',    icon: 'search' as const },
  { to: '/lines',     label: 'Lines',     icon: 'list' as const   },
  { to: '/settings',  label: 'Settings',  icon: 'cog' as const    },
  { to: '/messenger', label: 'Messenger', icon: 'send' as const   },
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
      v-slot="{ isActive }"
      custom
    >
      <a
        :href="tab.to"
        :aria-label="tab.label"
        class="flex items-center justify-center px-5 py-2 transition-colors"
        :class="isActive
          ? 'text-metro-accent'
          : 'text-metro-sub-light dark:text-metro-sub-dark hover:text-metro-fg-light dark:hover:text-metro-fg-dark'"
        @click.prevent="$router.push(tab.to)"
      >
        <HeroIcon :name="tab.icon" :size="26" :focused="isActive" />
      </a>
    </RouterLink>
  </nav>
</template>

<style scoped>
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
</style>
