<script setup lang="ts">

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
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

      <Text size="xs" color="secondary" class="mt-1">WALLET ADDRESS (tap to copy)</Text>

      <Pressable
        tag="button"
        type="button"
        class="w-[calc(100%-2rem)] mx-4 px-4 py-3.5 rounded-xl border text-center break-all
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        :style="{ borderColor: palette.border }"
        @click="copy"
      >
        <Text size="md" color="link">{{ address || '—' }}</Text>
      </Pressable>

      <Text size="xs" color="secondary" class="text-center px-4 mt-2 pb-6">
        {{ copied
          ? 'Address copied'
          : 'Scan or share this address to receive ETH or tokens on Ethereum mainnet.' }}
      </Text>
    </Col>
  </Col>
</template>
