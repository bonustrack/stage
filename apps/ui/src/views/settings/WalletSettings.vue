<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
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
        <!-- ACCOUNT: identity rows grouped into one card, mirroring mobile
             WalletSettings' ACCOUNT section (Name / Type). -->
        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-5 pb-1">ACCOUNT</Text>
        <Col
          class="w-[calc(100%-2rem)] mx-4 mt-2 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
          :style="{ borderColor: palette.border }"
        >
          <Row align="center" justify="between" :gap="16" class="px-4 py-3">
            <Text size="xs" class="text-metro-sub-light dark:text-metro-sub-dark">Name</Text>
            <Text size="sm" weight="medium" class="text-metro-fg-light dark:text-metro-fg-dark">{{ account.label ?? shortAddress(account.address) }}</Text>
          </Row>
          <Row
            align="center" justify="between" :gap="16" class="px-4 py-3 border-t"
            :style="{ borderColor: palette.border }"
          >
            <Text size="xs" class="text-metro-sub-light dark:text-metro-sub-dark">Type</Text>
            <Text size="sm" weight="medium" class="text-metro-fg-light dark:text-metro-fg-dark">{{ TYPE_LABEL[account.type] ?? account.type }}</Text>
          </Row>
        </Col>

        <!-- ADDRESS: copy-able address row, mirroring mobile WalletSettings ADDRESS. -->
        <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ADDRESS</Text>
        <Col
          class="w-[calc(100%-2rem)] mx-4 mt-2 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
          :style="{ borderColor: palette.border }"
        >
          <Pressable
            tag="button"
            type="button"
            class="block w-full p-3 text-left hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
            @click="copy('addr', account.address)"
          >
            <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">
              ADDRESS ({{ copiedKey === 'addr' ? 'copied!' : 'tap to copy' }})
            </Text>
            <Text size="xs" tag="div" class="text-metro-fg-light dark:text-metro-fg-dark mt-0.5 break-all">{{ account.address }}</Text>
          </Pressable>
        </Col>

        <!-- Manage accounts links to the Accounts screen, the web equivalent of
             mobile's smart-account / signer management entry. -->
        <Pressable
          tag="button"
          type="button"
          class="w-[calc(100%-2rem)] mx-4 mt-6 flex items-center gap-3 px-4 py-3.5 rounded-xl border
            bg-metro-surface-light dark:bg-metro-surface-dark
            hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
          :style="{ borderColor: palette.border }"
          @click="router.push('/accounts')"
        >
          <Icon name="users" :size="22" :color="palette.text" />
          <Text size="xl" class="flex-1 text-left text-metro-head-light dark:text-metro-head-dark">Manage accounts</Text>
          <Icon name="chevronRight" :size="18" :color="palette.sub" />
        </Pressable>
      </template>
    </Col>
  </Col>
</template>
