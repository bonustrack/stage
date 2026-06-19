import { createApp } from 'vue';
import type { Component } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { router } from './router';
import App from './App.vue';
import { installThemeClassEffect, setThemePreference } from './lib/theme';
import { installEmbedThemeBridge } from './lib/embedBridge';
import './style.css';

/** App-wide TanStack Query client — caches request/response data (profiles) with
 *  stale-while-revalidate + dedup. Live XMTP streams stay on their own path. */
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false } },
});

installThemeClassEffect();
installEmbedThemeBridge(setThemePreference);
createApp(App as Component).use(router).use(VueQueryPlugin, { queryClient }).mount('#app');
