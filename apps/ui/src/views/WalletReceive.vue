<script setup lang="ts">

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { basicRoot, receiveView, screenHeader, SCREEN_BACK, WALLET_ADDRESS_COPY } from '@stage-labs/views';
import { receiveViewModel } from '@stage-labs/client/wallet/receive';
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

const vm = computed(() =>
  receiveViewModel({
    mode: 'public', publicAddress: address.value, privateAddress: '', privateReady: false,
  }),
);

const addressNode = computed(() =>
  receiveView({
    address: address.value,
    label: vm.value.label,
    hint: copied.value ? 'Address copied' : vm.value.hint,
    borderColor: palette.border,
  }),
);

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'Receive',
    titleStyle: { kind: 'title', size: 'sm' },
    backColor: palette.text,
    safeTop: 0,
    padTop: 10,
    surface: palette.toolbarBg,
    borderColor: palette.border,
  })),
);

const registry: WidgetActionRegistry = {
  [SCREEN_BACK]: () => { router.back(); },
  [WALLET_ADDRESS_COPY]: () => { void copy(); },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <KitRenderer :node="headerNode" :registry="registry" />

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
