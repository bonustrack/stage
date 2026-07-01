<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { HeroIconName } from '@stage-labs/kit/icons';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode, ListViewItemNode } from '@stage-labs/kit/kit';
import {
  settingsHeader, settingsThemeRow, SCREEN_BACK, SETTINGS_THEME_SELECT,
} from '@stage-labs/views';
import { useEffectiveScheme } from '../../lib/kitTheme';
import {
  setThemePreference, useThemePreference, type ThemePreference,
  useCustomTheme, setCustomTheme,
  useDensity, useRadius, useBaseSize,
  setSeedColor, setDensity, setRadius, setBaseSize, seedColorValue, resetDisplayOverrides,
  type SeedColorKey, type Density, type RadiusName, type BaseSize,
} from '../../lib/theme';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'Display',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));
const pref = useThemePreference();
const custom = useCustomTheme();
const scheme = useEffectiveScheme();
const density = useDensity();
const radius = useRadius();
const baseSize = useBaseSize();

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: HeroIconName }[] = [
  { value: 'system', label: 'System', icon: 'desktop' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

const SEED_ROWS: { label: string; key: SeedColorKey }[] = [
  { label: 'surface-background', key: 'background' },
  { label: 'surface-foreground', key: 'foreground' },
  { label: 'accent', key: 'accent' },
  { label: 'grayscale', key: 'grayscale' },
];

const DENSITY_OPTS: Density[] = ['compact', 'normal', 'spacious'];
const RADIUS_OPTS: RadiusName[] = ['pill', 'round', 'soft', 'sharp'];
const BASE_SIZE_OPTS: BaseSize[] = [14, 15, 16, 17, 18];

function pickTheme(value: ThemePreference): void {
  setCustomTheme(false);
  setThemePreference(value);
}

function seedValue(key: SeedColorKey): string {
  return seedColorValue(scheme.value, key);
}

function onSeedInput(key: SeedColorKey, v: string): void {
  setSeedColor(scheme.value, key, v);
}

const selectedTheme = computed<ThemePreference | 'custom'>(() => custom.value ? 'custom' : pref.value);

const THEME_ROWS: { value: ThemePreference | 'custom'; label: string; icon: HeroIconName }[] = [
  ...THEME_OPTIONS,
  { value: 'custom', label: 'Custom', icon: 'colorSwatch' },
];

function themeItem(
  row: { value: ThemePreference | 'custom'; label: string; icon: HeroIconName },
): ListViewItemNode {
  return settingsThemeRow({
    value: row.value,
    label: row.label,
    iconName: row.icon,
    selected: selectedTheme.value === row.value,
    iconColor: 'text',
  });
}

const themeNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: THEME_ROWS.map(themeItem),
}));

const actions = {
  [SCREEN_BACK]: (): void => { router.back(); },
  [SETTINGS_THEME_SELECT]: (payload: Record<string, unknown>): void => {
    const value = payload.value;
    if (value === 'custom') { setCustomTheme(true); return; }
    if (value === 'system' || value === 'light' || value === 'dark') pickTheme(value);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="actions" />

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <!-- THEME: light/dark/system + custom, mirroring mobile's DisplaySettings list. -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-2">THEME</Col>
      <Col class="w-[calc(100%-2rem)] mx-4">
        <ViewHost :node="themeNode" :actions="actions" />
      </Col>

      <!-- CUSTOM COLORS / DENSITY / RADIUS / TEXT SIZE: live seed editor, mirroring
           mobile DisplaySettings + ColorTokens. The seed-derived palette flows through
           provideKitTheme (App.vue) so changes recolour the whole UI immediately. -->
      <template v-if="custom">
        <Row align="center" justify="between" class="px-4 pt-6 pb-1">
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">CUSTOM COLORS · {{ scheme }}</Col>
          <Pressable
            tag="button"
            type="button"
            class="text-[12px] px-2 py-1 rounded-md border
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
            :style="{ borderColor: palette.border, color: palette.text }"
            @click="resetDisplayOverrides()"
          >Reset</Pressable>
        </Row>
        <Col
          class="kit-block w-[calc(100%-2rem)] mx-4 mt-1 overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
          :style="{ borderColor: palette.border }"
        >
          <Row
            v-for="(row, i) in SEED_ROWS"
            :key="row.key"
            align="center"
            :gap="12"
            class="px-4 py-3"
            :class="i === 0 ? '' : 'border-t'"
            :style="i === 0 ? {} : { borderColor: palette.border }"
          >
            <Col
              class="h-9 w-9 shrink-0 rounded-lg border"
              :style="{ backgroundColor: seedValue(row.key), borderColor: palette.border }"
            />
            <span class="flex-1 text-[14px] text-metro-head-light dark:text-metro-head-dark">{{ row.label }}</span>
            <Input
              :model-value="seedValue(row.key)"
              :dark="scheme === 'dark'"
              size="sm"
              placeholder="#rrggbb"
              class="w-28 shrink-0"
              :aria-label="`${row.label} hex color`"
              @update:model-value="(v: string) => onSeedInput(row.key, v)"
            />
          </Row>
        </Col>

        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-2">DENSITY</Col>
        <Row :gap="8" class="px-4 flex-wrap">
          <Pressable
            v-for="opt in DENSITY_OPTS"
            :key="opt"
            tag="button"
            type="button"
            class="px-3 py-1.5 rounded-full border text-[13px] capitalize transition-colors"
            :style="opt === density
              ? { backgroundColor: palette.text, color: palette.bg, borderColor: palette.text }
              : { borderColor: palette.border, color: palette.text }"
            @click="setDensity(opt)"
          >{{ opt }}</Pressable>
        </Row>

        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-2">RADIUS</Col>
        <Row :gap="8" class="px-4 flex-wrap">
          <Pressable
            v-for="opt in RADIUS_OPTS"
            :key="opt"
            tag="button"
            type="button"
            class="px-3 py-1.5 rounded-full border text-[13px] capitalize transition-colors"
            :style="opt === radius
              ? { backgroundColor: palette.text, color: palette.bg, borderColor: palette.text }
              : { borderColor: palette.border, color: palette.text }"
            @click="setRadius(opt)"
          >{{ opt }}</Pressable>
        </Row>

        <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-2">TEXT SIZE</Col>
        <Row :gap="8" class="px-4 flex-wrap">
          <Pressable
            v-for="opt in BASE_SIZE_OPTS"
            :key="opt"
            tag="button"
            type="button"
            class="px-3 py-1.5 rounded-full border text-[13px] tabular-nums transition-colors"
            :style="opt === baseSize
              ? { backgroundColor: palette.text, color: palette.bg, borderColor: palette.text }
              : { borderColor: palette.border, color: palette.text }"
            @click="setBaseSize(opt)"
          >{{ opt }}</Pressable>
        </Row>
      </template>
    </Col>
  </Col>
</template>
