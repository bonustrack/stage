<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { HeroIconName } from '@stage-labs/kit/icons';
import pkg from '../../package.json';

const router = useRouter();
const palette = useKitPalette();

const APP_VERSION = pkg.version;

const ROWS: { icon: HeroIconName; label: string; to: string }[] = [
  { icon: 'sun', label: 'Display', to: '/settings/display' },
  { icon: 'chat', label: 'Messenger', to: '/settings/messenger' },
  { icon: 'beaker', label: 'Developer', to: '/settings/developer' },
  { icon: 'questionMarkCircle', label: 'About', to: '/settings/about' },
];
</script>

<template>
  <Col surface="surface" class="min-h-screen">
    <!-- Hub header mirrors the mobile SettingsMenu title bar. -->
    <Col class="px-4 pt-4 pb-2">
      <Title :level="1" class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Settings</Title>
    </Col>

    <!-- Category list: each row links to a subpage, mirroring mobile's ListView of ListViewItems. -->
    <Col
      class="w-[calc(100%-2rem)] mx-4 mt-2 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
      :style="{ borderColor: palette.border }"
    >
      <Pressable
        v-for="(row, i) in ROWS"
        :key="row.to"
        tag="button"
        type="button"
        class="w-full flex items-center gap-3 px-4 py-3.5 text-left
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
        :class="i === 0 ? '' : 'border-t'"
        :style="i === 0 ? {} : { borderColor: palette.border }"
        @click="router.push(row.to)"
      >
        <Icon :name="row.icon" :size="22" :color="palette.text" />
        <span class="flex-1 text-[17px] text-metro-head-light dark:text-metro-head-dark">{{ row.label }}</span>
        <Icon name="chevronRight" :size="18" :color="palette.sub" />
      </Pressable>
    </Col>

    <Col class="mt-6 mb-4 text-center text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
      Stage · v{{ APP_VERSION }}
    </Col>
  </Col>
</template>
