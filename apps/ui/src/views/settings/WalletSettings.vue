<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { ListViewNode } from '@stage-labs/kit/kit';
import {
  settingsHeader, settingsValueRow, settingsNavRow, SCREEN_BACK, SETTINGS_COPY, SETTINGS_NAV_PRESS,
} from '@stage-labs/views';
import { listAccounts, getActiveAccountId, type AccountRecord } from '../../lib/accounts';
import { shortAddress } from '../../lib/xmtp';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'Wallet',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

const account = ref<AccountRecord | null>(null);
const loaded = ref(false);
const copiedKey = ref('');

const TYPE_LABEL: Record<string, string> = {
  smart: 'Smart account',
  generated: 'Generated (local key)',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
};

onMounted(async () => {
  try {
    const [list, active] = await Promise.all([listAccounts(), getActiveAccountId()]);
    account.value = list.find(a => a.id === active) ?? list[0] ?? null;
  } catch { }
  loaded.value = true;
});

async function copy(key: string, value: string): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copiedKey.value = key;
    setTimeout(() => { if (copiedKey.value === key) copiedKey.value = ''; }, 1500);
  } catch { }
}

const accountNode = computed<ListViewNode>(() => {
  const acc = account.value;
  if (!acc) return { type: 'ListView', children: [] };
  return {
    type: 'ListView',
    children: [
      settingsValueRow({ label: 'Name', value: acc.label ?? shortAddress(acc.address) }),
      settingsValueRow({ label: 'Type', value: TYPE_LABEL[acc.type] ?? acc.type }),
    ],
  };
});

const addressNode = computed<ListViewNode>(() => {
  const acc = account.value;
  if (!acc) return { type: 'ListView', children: [] };
  return {
    type: 'ListView',
    children: [settingsValueRow({
      label: copiedKey.value === 'addr' ? 'copied!' : 'tap to copy',
      value: acc.address,
      copyType: SETTINGS_COPY,
      payload: { key: 'addr' },
    })],
  };
});

const manageNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'Manage accounts',
    iconStart: 'users',
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: '/accounts' },
  })],
}));

const actions = {
  [SCREEN_BACK]: (): void => { router.back(); },
  [SETTINGS_COPY]: (payload: Record<string, unknown>): void => {
    const value = payload.value;
    const key = payload.key;
    if (typeof value === 'string' && typeof key === 'string') void copy(key, value);
  },
  [SETTINGS_NAV_PRESS]: (payload: Record<string, unknown>): void => {
    const to = payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <ViewHost :node="headerNode" :actions="actions" />

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <Col v-if="loaded && !account" class="px-4 pt-6">
        <Text size="md" role="secondary">No active account.</Text>
      </Col>

      <template v-else-if="account">
        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-1">ACCOUNT</Text>
        <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
          <ViewHost :node="accountNode" :actions="actions" />
        </Col>

        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ADDRESS</Text>
        <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
          <ViewHost :node="addressNode" :actions="actions" />
        </Col>

        <Col class="w-[calc(100%-2rem)] mx-4 mt-6">
          <ViewHost :node="manageNode" :actions="actions" />
        </Col>
      </template>
    </Col>
  </Col>
</template>
