<script setup lang="ts">

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO, NETWORK_LABEL } from '@stage-labs/client/wallet/assets';
import { fmtUsd, fmtBalance } from '@stage-labs/client/wallet/format';
import { getTokenRow } from '@/lib/tokenDetailStore';

const route = useRoute();
const router = useRouter();

const id = computed(() => String(route.params.id ?? ''));
const row = computed(() => getTokenRow(id.value));

const valueUsd = computed(() => {
  const r = row.value;
  if (r?.priceUsd == null) return null;
  return r.priceUsd * Number(r.balance);
});

const networkLogo = computed(() =>
  (row.value ? NETWORK_LOGO[row.value.chainId] ?? MAINNET_NETWORK_LOGO : MAINNET_NETWORK_LOGO));

const networkLabel = computed(() => {
  const r = row.value;
  if (!r) return '';
  return NETWORK_LABEL[r.chainId] ?? `Chain ${r.chainId}`;
});

function back(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/wallet');
}

function send(): void {
  if (!id.value) return;
  void router.push({ path: '/wallet/send', query: { token: id.value } });
}
</script>

<template>
  <Col surface="surface" class="h-[100dvh] relative">
    <Row
      align="center"
      :gap="8"
      class="h-[52px] box-border shrink-0 px-3 border-b border-metro-border-light dark:border-metro-border-dark"
    >
      <Pressable
        tag="button"
        type="button"
        aria-label="Back"
        class="p-1 rounded-lg text-metro-link-light dark:text-metro-link-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        @click="back"
      >
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
      <Text size="xl" weight="semibold" color="link" class="flex-1 min-w-0" :truncate="true">
        {{ row ? row.name : 'Token' }}
      </Text>
    </Row>

    <Col class="flex-1 overflow-y-auto">
      <Col v-if="!row" align="center" class="py-10 px-4">
        <Text size="md" color="secondary">Token not found</Text>
      </Col>

      <template v-else>
        <Col align="start" :gap="6" class="pt-7 px-4">
          <Box class="relative w-[72px] h-[72px]">
            <Image
              :src="row.logoUrl"
              :size="72"
              radius="full"
              class="bg-metro-border-light dark:bg-metro-border-dark"
            />
            <Box
              class="absolute -right-0.5 -bottom-0.5 w-[30px] h-[30px] rounded-full overflow-hidden
                border-[3px] border-metro-bg-light dark:border-metro-bg-dark
                bg-metro-border-light dark:bg-metro-border-dark"
            >
              <Image :src="networkLogo" fit="cover" width="100%" height="100%" />
            </Box>
          </Box>

          <Row align="center" :gap="6" class="mt-2.5">
            <Text size="5xl" weight="semibold" color="link">{{ row.name }}</Text>
          </Row>

          <Box class="rounded-full px-2.5 py-0.5 border border-metro-border-light dark:border-metro-border-dark">
            <Text size="xs" color="secondary">{{ networkLabel }}</Text>
          </Box>

          <Text size="6xl" weight="semibold" color="link" class="mt-3.5">
            {{ `${fmtBalance(row.balance)} ${row.symbol}` }}
          </Text>
          <Text size="md" color="secondary">
            {{ valueUsd === null ? '—' : fmtUsd(valueUsd) }}
          </Text>
        </Col>

        <Row justify="start" :gap="36" class="px-4 mt-8">
          <Col align="center" :gap="6">
            <Pressable
              tag="button"
              type="button"
              aria-label="Send"
              class="w-14 h-14 rounded-full flex items-center justify-center
                bg-metro-border-light dark:bg-metro-border-dark
                hover:opacity-80"
              @click="send"
            >
              <Icon name="send" :size="26" class="text-metro-link-light dark:text-metro-link-dark" />
            </Pressable>
            <Text size="md" weight="semibold" color="link">Send</Text>
          </Col>

          <Col align="center" :gap="6">
            <Pressable
              tag="button"
              type="button"
              disabled
              aria-label="Shield"
              class="w-14 h-14 rounded-full flex items-center justify-center opacity-50
                bg-metro-border-light dark:bg-metro-border-dark cursor-not-allowed"
            >
              <Icon name="eyeOff" :size="26" class="text-metro-link-light dark:text-metro-link-dark" />
            </Pressable>
            <Text size="md" weight="semibold" color="link">Shield</Text>
          </Col>
        </Row>
      </template>
    </Col>
  </Col>
</template>
