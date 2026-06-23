<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useWalletBalances } from '@/lib/useWalletBalances';
import { buildSortedTokenRows } from '@/lib/walletSort';
import { fmtUsd, splitUsd } from '@stage-labs/client/wallet/format';
import type { WalletTab } from '@/lib/walletTab';

const router = useRouter();
const { rows, loading, error, refresh } = useWalletBalances();

const tab = ref<WalletTab>('tokens');

const totalUsd = computed(() =>
  (rows.value
    ? rows.value.reduce((s, r) => s + (r.priceUsd ?? 0) * Number(r.balance), 0)
    : null));

const totalParts = computed(() =>
  (totalUsd.value === null ? null : splitUsd(fmtUsd(totalUsd.value))));

const sortedRows = computed(() => (rows.value ? buildSortedTokenRows(rows.value) : []));
</script>

<template>
  <Col surface="surface" class="h-[100dvh] relative pb-[60px]">
    <Row align="center" class="h-[52px] box-border shrink-0 pl-2 pr-4" justify="between">
      <Row align="center" :gap="4">
        <AccountSwitcher />
        <Text size="4xl" weight="semibold" color="link" class="pl-2">Wallet</Text>
      </Row>
      <Pressable
        tag="button"
        type="button"
        aria-label="Refresh balances"
        :disabled="loading"
        class="p-2 rounded-lg text-metro-sub-light dark:text-metro-sub-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark disabled:opacity-50"
        @click="refresh"
      >
        <Icon name="refresh" :size="18" :class="loading ? 'animate-spin' : ''" />
      </Pressable>
    </Row>

    <Col class="flex-1 overflow-y-auto px-4 pb-6">
      <Col align="start" class="pt-1 pb-4">
        <Text v-if="error" size="md" color="danger">Couldn’t load balances</Text>
        <Text v-else-if="totalParts === null" size="7xl" weight="semibold" color="link">…</Text>
        <Text v-else size="7xl" weight="semibold" color="link">
          {{ totalParts.int }}<Text tag="span" size="7xl" weight="semibold" color="secondary">{{ totalParts.dec }}</Text>
        </Text>
      </Col>

      <Row justify="start" :gap="12" class="pb-5">
        <Col align="center" :gap="6">
          <Pressable
            tag="button"
            type="button"
            aria-label="Send"
            class="w-14 h-14 rounded-full flex items-center justify-center
              bg-metro-border-light dark:bg-metro-border-dark hover:opacity-80"
            @click="router.push('/wallet/send')"
          >
            <Icon name="send" :size="26" class="text-metro-link-light dark:text-metro-link-dark" />
          </Pressable>
          <Text size="md" weight="semibold" color="link">Send</Text>
        </Col>
        <Col align="center" :gap="6">
          <Pressable
            tag="button"
            type="button"
            aria-label="Receive"
            class="w-14 h-14 rounded-full flex items-center justify-center
              bg-metro-border-light dark:bg-metro-border-dark hover:opacity-80"
            @click="router.push('/wallet/receive')"
          >
            <Icon name="arrowDown" :size="26" class="text-metro-link-light dark:text-metro-link-dark" />
          </Pressable>
          <Text size="md" weight="semibold" color="link">Receive</Text>
        </Col>
      </Row>

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
