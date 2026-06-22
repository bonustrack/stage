<script setup lang="ts">

import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { HeroIconName } from '@stage-labs/kit/icons';

const router = useRouter();
const palette = useKitPalette();

const ROWS: { icon: HeroIconName; label: string; to: string }[] = [
  { icon: 'beaker', label: 'Developer', to: '/settings/developer' },
];
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
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
      <Title size="sm">Experimental</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <Col
        class="w-[calc(100%-2rem)] mx-4 mt-5 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
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
          <Text size="xl" class="flex-1 text-metro-head-light dark:text-metro-head-dark">{{ row.label }}</Text>
          <Icon name="chevronRight" :size="18" :color="palette.sub" />
        </Pressable>
      </Col>
    </Col>
  </Col>
</template>
