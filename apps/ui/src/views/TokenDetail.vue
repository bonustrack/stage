<script setup lang="ts">

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { BasicNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { walletActions, WALLET_ACTION_PRESS } from '@stage-labs/views';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, NETWORK_LABEL } from '@stage-labs/client/wallet/assets';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { getTokenRow } from '@/lib/tokenDetailStore';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();

const id = computed(() => String(route.params.id ?? ''));
const row = computed(() => getTokenRow(id.value));

const valueUsd = computed(() => {
  const r = row.value;
  if (r?.priceUsd == null) return null;
  return r.priceUsd * Number(r.balance);
});

const networkLogo = computed(() =>
  (row.value ? NETWORK_LOGO[row.value.chainId] ?? MAINNET_NETWORK_LOGO : MAINNET_NETWORK_LOGO));

const networkLabel = computed(() => {
  const r = row.value;
  if (!r) return '';
  return NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`;
});

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
  if (!r) return null;
  const usd = valueUsd.value;
  return {
    type: 'Basic',
    children: [
      {
        type: 'Col',
        align: 'start',
        gap: 6,
        children: [
          {
            type: 'Stack',
            width: 72,
            height: 72,
            children: [
              { type: 'Image', src: r.logoUrl, size: 72, radius: 'full', background: palette.border },
              {
                type: 'Box',
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                radius: 'full',
                background: palette.border,
                border: { size: 3, color: palette.bg },
                children: [
                  { type: 'Image', src: networkLogo.value, fit: 'cover', width: '100%', height: '100%', radius: 'full' },
                ],
              },
            ],
          },
          { type: 'Title', value: r.name, size: '5xl', weight: 'semibold', color: 'link' },
          {
            type: 'Box',
            radius: 'full',
            padding: { x: 10, y: 3 },
            border: { size: 1, color: palette.border },
            children: [{ type: 'Caption', value: networkLabel.value, color: 'secondary', size: 'sm' }],
          },
          { type: 'Title', value: `${fmtBalance(r.balance)} ${r.symbol}`, size: '6xl', weight: 'semibold', color: 'link' },
          { type: 'Text', value: usd === null ? '—' : fmtUsd(usd), size: 'md', color: 'secondary' },
          {
            type: 'Box',
            padding: { top: 26 },
            children: [
              walletActions({
                gap: 36,
                actions: [
                  { label: 'Send', icon: 'send', pressType: WALLET_ACTION_PRESS, bg: palette.border, payload: { action: 'send' } },
                ],
              }),
            ],
          },
        ],
      },
    ],
  };
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
