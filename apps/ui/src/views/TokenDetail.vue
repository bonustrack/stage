<script setup lang="ts">

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { BasicNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { tokenDetailCard, WALLET_ACTION_PRESS } from '@stage-labs/views';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, NETWORK_LABEL } from '@stage-labs/client/wallet/assets';
import { tokenDetailViewModel } from '@stage-labs/client/wallet/tokenDetail';
import { getTokenRow } from '@/lib/tokenDetailStore';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();

const id = computed(() => String(route.params.id ?? ''));
const row = computed(() => getTokenRow(id.value));

const vm = computed(() =>
  (row.value ? tokenDetailViewModel(row.value, { networkLabels: NETWORK_LABEL }) : null));

const networkLogo = computed(() =>
  (row.value ? NETWORK_LOGO[row.value.chainId] ?? MAINNET_NETWORK_LOGO : MAINNET_NETWORK_LOGO));

function back(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/wallet');
}

function send(): void {
  if (!id.value) return;
  void router.push({ path: '/wallet/send', query: { token: id.value } });
}

const detailNode = computed<BasicNode | null>(() => {
  const r = row.value;
  const data = vm.value;
  if (!r || !data) return null;
  return tokenDetailCard({
    logoSrc: r.logoUrl,
    networkLogo: networkLogo.value,
    networkLabel: data.networkLabel,
    name: data.name,
    balanceLabel: data.balanceLabel,
    usdLabel: data.usdLabel,
    borderColor: palette.border,
    bgColor: palette.bg,
    actions: [
      { label: 'Send', icon: 'send', pressType: WALLET_ACTION_PRESS, bg: palette.border, payload: { action: 'send' } },
    ],
    actionsPadTop: 26,
  });
});

const registry: WidgetActionRegistry = {
  [WALLET_ACTION_PRESS]: (action) => {
    if (action.payload.action === 'send') send();
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh] relative">
    <Row
      align="center"
      :gap="8"
      class="h-[52px] box-border shrink-0 px-3 border-b border-metro-border-light dark:border-metro-border-dark"
    >
      <Pressable
        tag="button"
        type="button"
        aria-label="Back"
        class="p-1 rounded-lg text-metro-link-light dark:text-metro-link-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        @click="back"
      >
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Text size="xl" weight="semibold" color="link" class="flex-1 min-w-0" :truncate="true">
        {{ row ? row.name : 'Token' }}
      </Text>
    </Row>

    <Col class="flex-1 overflow-y-auto">
      <Col v-if="!row" align="center" class="py-10 px-4">
        <Text size="md" color="secondary">Token not found</Text>
      </Col>

      <Col v-else-if="detailNode" class="pt-7 px-4">
        <KitRenderer :node="detailNode" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
