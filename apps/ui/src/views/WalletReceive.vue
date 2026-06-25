<script setup lang="ts">

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { addressCard, WALLET_ADDRESS_COPY } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import { getActiveAccount } from '../lib/accounts';
import { shortAddress, stampAvatarUrl } from '../lib/xmtp';

const router = useRouter();
const palette = useKitPalette();

const address = ref('');
const qrSrc = ref('');
const copied = ref(false);

async function renderQr(value: string): Promise<void> {
  if (!value) {
    qrSrc.value = '';
    return;
  }
  qrSrc.value = await QRCode.toDataURL(value, {
    width: 480,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

onMounted(async () => {
  const account = await getActiveAccount();
  if (!account) return;
  address.value = account.address;
  await renderQr(account.address);
});

async function copy(): Promise<void> {
  if (!address.value) return;
  await navigator.clipboard.writeText(address.value);
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1500);
}

const addressNode = computed(() =>
  basicRoot(
    addressCard({
      label: 'Wallet address (tap to copy)',
      address: address.value || '—',
      hint: copied.value
        ? 'Address copied'
        : 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.',
    }),
  ),
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

      <!-- QR of the public address, rendered to a data URL via qrcode. -->
      <Box
        background="#ffffff"
        radius="xl"
        :padding="16"
        align="center"
        justify="center"
        :style="{ borderWidth: '1px', borderStyle: 'solid', borderColor: palette.border }"
      >
        <Image v-if="qrSrc" :src="qrSrc" :width="240" :height="240" alt="Wallet address QR code" />
        <Box v-else :width="240" :height="240" background="#f4f4f5" />
      </Box>

      <Col class="w-[calc(100%-2rem)] mx-4 pb-6">
        <KitRenderer :node="addressNode" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
