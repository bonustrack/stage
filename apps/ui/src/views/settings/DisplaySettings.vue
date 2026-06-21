<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { HeroIconName } from '@stage-labs/kit/icons';
import {
  setThemePreference, useThemePreference, type ThemePreference,
} from '../../lib/theme';

const router = useRouter();
const palette = useKitPalette();
const pref = useThemePreference();

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <!-- Toolbar header matches the XMTP screens: back arrow + small title. -->
    <Row
      surface="toolbar"
      align="center"
      :gap="8"
      :padding="{ x: 12, y: 10 }"
      :style="{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: palette.border }"
    >
      <Pressable tag="button" type="button" class="p-1" @click="router.back()">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Display</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <!-- THEME: light/dark/system, mirroring mobile's DisplaySettings theme list. -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-2">THEME</Col>
      <Col
        class="w-[calc(100%-2rem)] mx-4 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Pressable
          v-for="(opt, i) in THEME_OPTIONS"
          :key="opt.value"
          tag="button"
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3.5 text-left
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          :class="i === 0 ? '' : 'border-t'"
          :style="i === 0 ? {} : { borderColor: palette.border }"
          @click="setThemePreference(opt.value)"
        >
          <Icon :name="opt.icon" :size="22" :color="palette.text" />
          <span class="flex-1 text-[15px] text-metro-fg-light dark:text-metro-fg-dark">{{ opt.label }}</span>
          <Icon v-if="pref === opt.value" name="check" :size="20" :color="palette.text" />
        </Pressable>
      </Col>

      <!-- Custom theme (seed colors / density / radius / text-size) is a mobile-only
           feature today: the web theme layer exposes light/dark/system only, so the
           custom-theme editor is deferred until provideKitTheme gains those controls on web. -->
      <Col class="px-4 pt-5 text-[12px] text-metro-sub-light dark:text-metro-sub-dark">
        Custom colors, density and radius are not available on web yet.
      </Col>
    </Col>
  </Col>
</template>
