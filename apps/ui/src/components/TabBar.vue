<script setup lang="ts">
/** Bottom tab bar — Home / Search / Lines / Settings. Mirrors apps/app/(tabs)/_layout.tsx. */

const TABS = [
  { to: '/',          label: 'Home',      icon: 'home' as const   },
  { to: '/messenger', label: 'Messenger', icon: 'send' as const   },
  { to: '/search',    label: 'Search',    icon: 'search' as const },
  { to: '/lines',     label: 'Lines',     icon: 'chat' as const   },
  { to: '/settings',  label: 'Settings',  icon: 'cog' as const    },
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
        class="flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors"
        :class="isActive
          ? 'text-metro-accent font-bold'
          : 'text-metro-sub-light dark:text-metro-sub-dark hover:text-metro-fg-light dark:hover:text-metro-fg-dark'"
        @click.prevent="$router.push(tab.to)"
      >
        <HeroIcon :name="tab.icon" :size="24" :focused="isActive" />
        <span class="text-[11px] font-semibold">{{ tab.label }}</span>
      </a>
    </RouterLink>
  </nav>
</template>

<style scoped>
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
</style>
