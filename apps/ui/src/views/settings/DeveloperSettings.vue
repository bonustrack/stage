<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import pkg from '../../../package.json';
import { getXmtpEnv } from '../../lib/xmtp';
import { getHostAccount } from '../../lib/hostSigner';

const router = useRouter();
const palette = useKitPalette();

const rows = ref<{ label: string; value: string }[]>([
  { label: 'XMTP env', value: getXmtpEnv() },
  { label: 'Build profile', value: import.meta.env.DEV ? 'dev' : 'release' },
  { label: 'Version', value: pkg.version },
  { label: 'Signer', value: 'local wallet (auto-generated)' },
]);

onMounted(async () => {
  const host = await getHostAccount().catch(() => null);
  if (host) rows.value[3] = { label: 'Signer', value: 'host wallet' };
});
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
      <Title size="sm">Developer</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8 px-4 pt-4">
      <!-- DIAGNOSTICS: read-only env + build info, mirroring mobile DeveloperSettings
           (the Railgun debug toggle and reset/danger actions are mobile-only and deferred). -->
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark pb-1">DIAGNOSTICS</Col>
      <Col
        class="w-full rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Row
          v-for="(row, i) in rows"
          :key="row.label"
          align="center"
          justify="between"
          :gap="16"
          class="px-4 py-3.5"
          :class="i === 0 ? '' : 'border-t'"
          :style="i === 0 ? {} : { borderColor: palette.border }"
        >
          <span class="text-[13px] text-metro-sub-light dark:text-metro-sub-dark">{{ row.label }}</span>
          <span class="text-[14px] font-medium text-metro-fg-light dark:text-metro-fg-dark break-all text-right">{{ row.value }}</span>
        </Row>
      </Col>
    </Col>
  </Col>
</template>
