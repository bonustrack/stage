<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import pkg from '../../../package.json';

const router = useRouter();
const palette = useKitPalette();

const GITHUB_URL = 'https://github.com/bonustrack/stage';

const ROWS: { label: string; value: string }[] = [
  { label: 'App', value: 'Stage' },
  { label: 'Version', value: pkg.version },
  { label: 'Build profile', value: import.meta.env.DEV ? 'dev' : 'release' },
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
      <Title size="sm">About</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8 px-4 pt-4">
      <!-- Build + runtime metadata, mirroring the mobile About panel's metadata rows. -->
      <Text variant="secondary" weight="medium" size="xs" class="mb-2">Build + runtime metadata for this install.</Text>
      <Col
        class="w-full rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Row
          v-for="(row, i) in ROWS"
          :key="row.label"
          align="center"
          justify="between"
          :gap="16"
          class="px-4 py-3.5"
          :class="i === 0 ? '' : 'border-t'"
          :style="i === 0 ? {} : { borderColor: palette.border }"
        >
          <Text size="xs" class="text-metro-sub-light dark:text-metro-sub-dark">{{ row.label }}</Text>
          <Text size="sm" weight="medium" class="text-metro-fg-light dark:text-metro-fg-dark">{{ row.value }}</Text>
        </Row>
      </Col>

      <!-- GitHub link, mirroring the mobile About "View Stage on GitHub" card. -->
      <a
        :href="GITHUB_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl border
          bg-metro-surface-light dark:bg-metro-surface-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
        :style="{ borderColor: palette.border }"
      >
        <Icon name="code" :size="22" :color="palette.text" />
        <Col class="flex-1 min-w-0">
          <Text size="xl" class="text-metro-head-light dark:text-metro-head-dark">View Stage on GitHub</Text>
          <Text size="2xs" class="text-metro-sub-light dark:text-metro-sub-dark">bonustrack/stage</Text>
        </Col>
        <Icon name="externalLink" :size="18" :color="palette.sub" />
      </a>
    </Col>
  </Col>
</template>
