<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import {
  settingsValueRow, settingsNavRow, SETTINGS_COPY, SETTINGS_NAV_PRESS,
} from '@stage-labs/views';
import { listAccounts, getActiveAccountId, type AccountRecord } from '../../lib/accounts';
import { shortAddress } from '../../lib/xmtp';

const router = useRouter();
const palette = useKitPalette();

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

const registry: WidgetActionRegistry = {
  [SETTINGS_COPY]: (action) => {
    const value = action.payload.value;
    const key = action.payload.key;
    if (typeof value === 'string' && typeof key === 'string') void copy(key, value);
  },
  [SETTINGS_NAV_PRESS]: (action) => {
    const to = action.payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
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
      <Title size="sm">Wallet</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <Col v-if="loaded && !account" class="px-4 pt-6">
        <Text size="md" role="secondary">No active account.</Text>
      </Col>

      <template v-else-if="account">
        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-1">ACCOUNT</Text>
        <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
          <ChatKitRenderer :node="accountNode" :registry="registry" />
        </Col>

        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ADDRESS</Text>
        <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
          <ChatKitRenderer :node="addressNode" :registry="registry" />
        </Col>

        <Col class="w-[calc(100%-2rem)] mx-4 mt-6">
          <ChatKitRenderer :node="manageNode" :registry="registry" />
        </Col>
      </template>
    </Col>
  </Col>
</template>
