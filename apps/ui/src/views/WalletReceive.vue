<script setup lang="ts">

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { receiveView, WALLET_ADDRESS_COPY } from '@stage-labs/views';
import { getActiveAccount } from '../lib/accounts';
import { shortAddress, stampAvatarUrl } from '../lib/xmtp';

const router = useRouter();
const palette = useKitPalette();

const address = ref('');
const copied = ref(false);

onMounted(async () => {
  const account = await getActiveAccount();
  if (!account) return;
  address.value = account.address;
});

async function copy(): Promise<void> {
  if (!address.value) return;
  await navigator.clipboard.writeText(address.value);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1500);
}

const addressNode = computed(() =>
  receiveView({
    address: address.value,
    label: 'Wallet address (tap to copy)',
    hint: copied.value
      ? 'Address copied'
      : 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.',
    borderColor: palette.border,
  }),
);

const registry: WidgetActionRegistry = {
  [WALLET_ADDRESS_COPY]: () => { void copy(); },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <!-- Toolbar header mirrors the mobile wallet Receive title bar. -->
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
      <Title size="sm">Receive</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar" align="center" :gap="16">
      <!-- Active account identity mirrors mobile's avatar + address header. -->
      <Row align="center" :gap="10" class="mt-6">
        <AvatarView v-if="address" :src="stampAvatarUrl(address, 56)" :size="28" />
        <Text size="md" weight="semibold" color="link">{{ address ? shortAddress(address) : '…' }}</Text>
      </Row>

      <Col class="w-[calc(100%-2rem)] mx-4 pb-6">
        <KitRenderer :node="addressNode" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
