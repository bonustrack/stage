<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { rememberTokenRow } from '@/lib/tokenDetailStore';

const props = defineProps<{ r: AssetRow }>();

const router = useRouter();

function open(): void {
  const id = rememberTokenRow(props.r);
  void router.push(`/wallet/token/${encodeURIComponent(id)}`);
}

const valueUsd = computed(() =>
  (props.r.priceUsd === null ? null : props.r.priceUsd * Number(props.r.balance)));

const priceText = computed(() =>
  (props.r.priceUsd === null
    ? props.r.symbol
    : fmtUsd(props.r.priceUsd, props.r.priceUsd < 1 ? 4 : 2)));

const changeText = computed(() =>
  (props.r.change24h === null
    ? ''
    : `${props.r.change24h >= 0 ? '+' : ''}${props.r.change24h.toFixed(2)}%`));

const changeColor = computed<'secondary' | 'success' | 'danger'>(() =>
  (props.r.change24h === null ? 'secondary' : props.r.change24h >= 0 ? 'success' : 'danger'));

const networkLogo = computed(() => NETWORK_LOGO[props.r.chainId] ?? MAINNET_NETWORK_LOGO);
</script>

<template>
  <Pressable
    tag="button"
    type="button"
    class="block w-full text-left active:opacity-60"
    @click="open"
  >
  <Row align="center" :gap="12" class="py-3.5">
    <Box class="relative w-8 h-8 shrink-0">
      <Image
        :src="props.r.logoUrl"
        :size="32"
        radius="full"
        class="bg-metro-border-light dark:bg-metro-border-dark"
      />
      <Box
        class="absolute -right-[3px] -bottom-[3px] w-[18px] h-[18px] rounded-full overflow-hidden
          border-[2.5px] border-metro-bg-light dark:border-metro-bg-dark
          bg-metro-border-light dark:bg-metro-border-dark"
      >
        <Image :src="networkLogo" fit="cover" width="100%" height="100%" />
      </Box>
    </Box>

    <Col class="flex-1 min-w-0">
      <Text size="4xl" weight="semibold" color="link" :truncate="true">{{ props.r.name }}</Text>
      <Row align="center" :gap="6" class="mt-0.5">
        <Text size="md" color="secondary">{{ priceText }}</Text>
        <Text v-if="changeText" size="md" :color="changeColor">{{ changeText }}</Text>
      </Row>
    </Col>

    <Col align="end" class="shrink-0">
      <Text size="4xl" weight="semibold" color="link">
        {{ valueUsd === null ? '—' : fmtUsd(valueUsd) }}
      </Text>
      <Text size="md" color="secondary" class="mt-0.5">
        {{ `${fmtBalance(props.r.balance)} ${props.r.symbol}` }}
      </Text>
    </Col>
  </Row>
  </Pressable>
</template>
