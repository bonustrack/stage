<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { balanceHeader, WALLET_ACTION_PRESS } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import { useWalletBalances } from '@/lib/useWalletBalances';
import { buildSortedTokenRows } from '@stage-labs/client/wallet/tokens';
import { fmtUsd, splitUsd } from '@stage-labs/client/wallet/format';
import type { WalletTab } from '@/lib/walletTab';

const router = useRouter();
const palette = useKitPalette();
const { rows, loading, error, refresh } = useWalletBalances();

const tab = ref<WalletTab>('tokens');

const totalUsd = computed(() =>
  (rows.value
    ? rows.value.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0)
    : null));

const totalParts = computed(() =>
  (totalUsd.value === null ? null : splitUsd(fmtUsd(totalUsd.value))));

const sortedRows = computed(() => (rows.value ? buildSortedTokenRows(rows.value) : []));

const heroNode = computed(() => {
  const parts = totalParts.value;
  return basicRoot(balanceHeader({
    total: error.value || !parts ? '…' : parts.int,
    totalDecimals: error.value || !parts ? undefined : parts.dec,
    heroSize: '7xl',
    actions: [
      { label: 'Send', icon: 'send', pressType: WALLET_ACTION_PRESS, bg: palette.border, payload: { action: 'send' } },
      { label: 'Receive', icon: 'arrowDown', pressType: WALLET_ACTION_PRESS, bg: palette.border, payload: { action: 'receive' } },
    ],
  }));
});

const heroRegistry: WidgetActionRegistry = {
  [WALLET_ACTION_PRESS]: (action) => {
    if (action.payload.action === 'send') void router.push('/wallet/send');
    else if (action.payload.action === 'receive') void router.push('/wallet/receive');
  },
};
</script>

<template>
  <!-- Mobile parity (components/tabs/WalletScreen.tsx): identity-only hoisted
       topnav (no title, no header actions); the refresh button lives in the scroll
       body top-right (size 22, spinning while refreshing), above the balance hero. -->
  <Col surface="surface" class="flex-1 min-h-0 relative">
    <Col class="flex-1 overflow-y-auto px-4 pb-6">
      <Row justify="end" align="center" :gap="18" class="pt-2">
        <Pressable
          tag="button"
          type="button"
          aria-label="Refresh balances"
          :disabled="loading"
          class="disabled:opacity-50"
          @click="refresh"
        >
          <Icon
            name="refresh"
            :size="22"
            class="text-metro-link-light dark:text-metro-link-dark"
            :class="loading ? 'animate-spin' : ''"
          />
        </Pressable>
      </Row>
      <Col class="pt-1 pb-5">
        <Text v-if="error" size="md" color="danger" class="pb-4">Couldn’t load balances</Text>
        <KitRenderer :node="heroNode" :registry="heroRegistry" />
      </Col>

      <WalletTabs v-model="tab" class="-mx-4" />

      <template v-if="tab === 'tokens'">
        <Col
          v-if="error"
          align="center"
          class="py-10"
        >
          <Text size="md" color="danger">Couldn’t load tokens</Text>
        </Col>

        <Col
          v-else-if="rows === null"
          align="center"
          class="py-10 text-metro-link-light dark:text-metro-link-dark"
        >
          <Spinner :size="28" />
        </Col>

        <Col v-else-if="sortedRows.length === 0" align="center" class="py-10">
          <Text size="md" color="secondary">No tokens yet</Text>
        </Col>

        <Col v-else>
          <TokenRow v-for="row in sortedRows" :key="row.id" :r="row.r" />
        </Col>
      </template>

      <ActivityList v-else-if="tab === 'activity'" class="-mx-4" />

      <NftGrid v-else class="-mx-4" />
    </Col>
  </Col>
</template>
