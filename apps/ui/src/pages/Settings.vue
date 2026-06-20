<script setup lang="ts">

import pkg from '../../package.json';
import { getOrCreateXmtpClient, shortAddress } from '../lib/xmtp';
import { setThemePreference, useThemePreference, type ThemePreference } from '../lib/theme';

const APP_VERSION = pkg.version;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const pref = useThemePreference();
const myAddress = ref<string>('');
const copied = ref(false);

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    myAddress.value = client.accountIdentifier?.identifier ?? '';
  } catch { }
});

async function copyAddress(): Promise<void> {
  if (!myAddress.value) return;
  try {
    await navigator.clipboard.writeText(myAddress.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch { }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="px-4 pt-4 pb-2">
      <h1 class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Settings</h1>
    </div>

    <button
      v-if="myAddress"
      type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copyAddress"
    >
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        YOUR XMTP ADDRESS ({{ copied ? 'copied!' : 'tap to copy' }})
      </div>
      <div class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-0.5">
        {{ shortAddress(myAddress) }}
      </div>
    </button>

    <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-2">THEME</div>
    <div class="mx-4 rounded-xl overflow-hidden border border-metro-border-light dark:border-metro-border-dark
      bg-metro-surface-light dark:bg-metro-surface-dark">
      <button
        v-for="(opt, i) in THEME_OPTIONS"
        :key="opt.value"
        type="button"
        class="w-full flex items-center justify-between px-4 py-3.5 text-left
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
        :class="i === 0 ? '' : 'border-t border-metro-border-light dark:border-metro-border-dark'"
        @click="setThemePreference(opt.value)"
      >
        <span class="text-metro-fg-light dark:text-metro-fg-dark text-[15px]">{{ opt.label }}</span>
        <span v-if="pref === opt.value" class="text-metro-fg-light dark:text-metro-fg-dark text-lg">✓</span>
      </button>
    </div>

    <div class="mt-6 mb-4 text-center text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
      Stage · v{{ APP_VERSION }}
    </div>
  </div>
</template>
