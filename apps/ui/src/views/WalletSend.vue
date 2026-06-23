<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Hex } from 'viem';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { NETWORK_LABEL, NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { fmtBalance } from '@stage-labs/client/wallet/format';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useWalletBalances } from '@/lib/useWalletBalances';
import { buildSortedTokenRows } from '@/lib/walletSort';
import { getTokenRow } from '../lib/tokenDetailStore';
import { useSend } from '../lib/useSend';
import { useEffectiveScheme } from '@/lib/kitTheme';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();
const scheme = useEffectiveScheme();

const { rows } = useWalletBalances();

const choices = computed<AssetRow[]>(() =>
  (rows.value ? buildSortedTokenRows(rows.value).map(({ r }) => r) : []));

const tokenId = computed(() => {
  const t = route.query.token;
  return Array.isArray(t) ? (t[0] ?? '') : (t ?? '');
});
const initialRow = computed(() => (tokenId.value ? getTokenRow(tokenId.value) : null));

const selected = ref<AssetRow | null>(initialRow.value);
const touched = ref(!!initialRow.value);

watch(choices, (list) => {
  if (touched.value || list.length === 0) return;
  selected.value = list[0] ?? null;
});

const pickerOpen = ref(false);

function pick(r: AssetRow): void {
  selected.value = r;
  touched.value = true;
  pickerOpen.value = false;
}

const symbolRef = computed(() => selected.value?.symbol ?? 'ETH');
const chainIdRef = computed(() => selected.value?.chainId ?? 1);
const balanceRef = computed<string | null>(() => selected.value?.balance ?? null);
const priceUsd = computed<number | null>(() => selected.value?.priceUsd ?? null);

const send = useSend(symbolRef, chainIdRef, balanceRef);

const networkLabel = computed(() => NETWORK_LABEL[chainIdRef.value] ?? `Chain ${chainIdRef.value}`);
const selectedLogo = computed(() => selected.value?.logoUrl ?? '');
const selectedNetworkLogo = computed(() => NETWORK_LOGO[chainIdRef.value] ?? MAINNET_NETWORK_LOGO);

const mode = ref<'token' | 'usd'>('token');

const secondaryLabel = computed(() => {
  const price = priceUsd.value;
  const raw = send.amount.value.trim();
  if (!price || !raw) return '';
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return '';
  return mode.value === 'token'
    ? `≈ $${(n * price).toFixed(2)}`
    : `≈ ${(n / price).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')} ${send.symbol.value}`;
});

function toggleMode(): void {
  const price = priceUsd.value;
  const raw = send.amount.value.trim();
  if (!price || !raw) {
    mode.value = mode.value === 'token' ? 'usd' : 'token';
    return;
  }
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) {
    mode.value = mode.value === 'token' ? 'usd' : 'token';
    return;
  }
  if (mode.value === 'token') {
    send.amount.value = (n * price).toFixed(2);
    mode.value = 'usd';
  } else {
    send.amount.value = (n / price).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    mode.value = 'token';
  }
}

const submitLabel = computed(() => {
  switch (send.txState.value) {
    case 'submitting': return 'Confirm in wallet…';
    case 'pending': return 'Sending…';
    case 'confirmed': return 'Sent ✓';
    default: return 'Send';
  }
});

function back(): void {
  if (window.history.length > 1) router.back();
  else void router.push('/wallet');
}

function openTx(hash: Hex): void {
  window.open(explorerTxUrl(chainIdRef.value, hash), '_blank', 'noopener');
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
      <Pressable tag="button" type="button" class="p-1" aria-label="Back" @click="back">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Send token</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar" :gap="16" :padding="{ x: 16, y: 16 }">
      <!-- Token selector mirrors mobile's TokenSelector. -->
      <Col :gap="6">
        <Text size="xs" color="secondary">TOKEN</Text>
        <Pressable
          tag="button"
          type="button"
          class="block w-full hover:opacity-80"
          @click="pickerOpen = true"
        >
          <Row surface="raised" align="center" :gap="10" class="rounded-xl px-3.5 py-3">
            <Box class="relative w-7 h-7 shrink-0">
              <Image
                :src="selectedLogo"
                :size="28"
                radius="full"
                class="bg-metro-border-light dark:bg-metro-border-dark"
              />
              <Box
                class="absolute -right-[3px] -bottom-[3px] w-[15px] h-[15px] rounded-full overflow-hidden
                  border-2 border-metro-bg-light dark:border-metro-bg-dark
                  bg-metro-border-light dark:bg-metro-border-dark"
              >
                <Image :src="selectedNetworkLogo" fit="cover" width="100%" height="100%" />
              </Box>
            </Box>
            <Col class="flex-1 min-w-0" align="start">
              <Text size="md" weight="semibold" color="link" :truncate="true">{{ send.symbol.value }}</Text>
              <Text size="xs" color="secondary" :truncate="true">
                {{ selected ? `Balance: ${fmtBalance(selected.balance)}` : '—' }}
              </Text>
            </Col>
            <Icon name="chevronDown" :size="18" :color="palette.text" />
          </Row>
        </Pressable>
      </Col>

      <Box class="self-start rounded-full px-2.5 py-0.5 border" :style="{ borderColor: palette.border }">
        <Text size="xs" color="secondary">{{ networkLabel }}</Text>
      </Box>

      <!-- Recipient -->
      <Col :gap="6">
        <Text size="xs" color="secondary">RECIPIENT</Text>
        <Row surface="raised" align="center" :gap="6" class="rounded-xl px-3.5">
          <Input
            v-model="send.to.value"
            :dark="scheme === 'dark'"
            placeholder="0x… or name.eth"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="flex-1 bg-transparent border-0 py-3 outline-none"
          />
        </Row>
        <Row v-if="send.resolving.value" align="center" :gap="8" class="px-1">
          <Text size="xs" color="secondary">Resolving…</Text>
        </Row>
        <Text v-else-if="send.resolved.value" size="xs" color="secondary" class="px-1 break-all">
          {{ shortAddress(send.resolved.value) }}
        </Text>
        <Text v-else-if="send.resolveErr.value" size="xs" class="px-1" :style="{ color: palette.danger }">
          {{ send.resolveErr.value }}
        </Text>
      </Col>

      <!-- Amount -->
      <Col :gap="6">
        <Row align="center">
          <Text size="xs" color="secondary" class="flex-1">AMOUNT</Text>
          <Pressable
            tag="button"
            type="button"
            :disabled="send.balance.value == null"
            class="px-2 py-0.5 rounded"
            @click="mode = 'token'; send.onMax()"
          >
            <Text size="xs" :color="send.balance.value == null ? 'secondary' : 'link'">MAX</Text>
          </Pressable>
        </Row>
        <Row surface="raised" align="center" :gap="8" class="rounded-xl px-3.5 py-3">
          <Input
            v-model="send.amount.value"
            :dark="scheme === 'dark'"
            placeholder="0.0"
            inputmode="decimal"
            class="flex-1 bg-transparent border-0 outline-none text-xl font-semibold"
          />
          <Pressable
            tag="button"
            type="button"
            class="rounded-full hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            @click="toggleMode"
          >
            <Row align="center" :gap="4" class="px-2 py-1">
              <Text weight="semibold" size="md" color="link">
                {{ mode === 'token' ? send.symbol.value : 'USD' }}
              </Text>
              <Icon name="arrowDown" :size="14" :color="palette.text" />
            </Row>
          </Pressable>
        </Row>
        <Text v-if="secondaryLabel" size="xs" color="secondary" class="px-1">{{ secondaryLabel }}</Text>
        <Text v-if="send.amountErr.value" size="xs" class="px-1" :style="{ color: palette.danger }">
          {{ send.amountErr.value }}
        </Text>
        <Text v-if="send.balance.value != null" size="xs" color="secondary" class="px-1">
          Balance: {{ fmtBalance(send.balance.value) }} {{ send.symbol.value }}
        </Text>
      </Col>

      <!-- Fee preview -->
      <Col surface="raised" :gap="6" class="rounded-xl px-3.5 py-3">
        <Row align="center">
          <Text size="xs" color="secondary" class="flex-1">NETWORK FEE</Text>
          <Text size="xs" color="link">
            {{ send.fee.value
              ? (send.fee.value.sponsored ? 'Gas sponsored' : `≈ ${Number(send.fee.value.feeEth).toFixed(6)} ETH`)
              : '—' }}
          </Text>
        </Row>
        <Text v-if="send.feeErr.value" size="xs" color="secondary" class="break-all">
          {{ send.feeErr.value }}
        </Text>
      </Col>

      <Col v-if="send.txHash.value" :gap="4" class="px-1">
        <Text size="xs" color="secondary">
          {{ send.txState.value === 'confirmed' ? 'Confirmed' : 'Pending' }}
        </Text>
        <Pressable tag="button" type="button" @click="openTx(send.txHash.value as Hex)">
          <Text size="xs" color="link">
            {{ send.txHash.value.slice(0, 10) }}…{{ send.txHash.value.slice(-8) }}
          </Text>
        </Pressable>
      </Col>
      <Text v-if="send.txErr.value" size="xs" class="px-1 break-all" :style="{ color: palette.danger }">
        {{ send.txErr.value }}
      </Text>
    </Col>

    <!-- Sticky Cancel/Submit footer mirrors mobile WalletFooter. -->
    <Row
      surface="surface"
      :gap="12"
      :padding="{ x: 16, top: 12, bottom: 12 }"
      :style="{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: palette.border }"
    >
      <Pressable
        tag="button"
        type="button"
        class="flex-1 rounded-full py-3.5 text-center border"
        :style="{ borderColor: palette.border }"
        @click="back"
      >
        <Text size="md" weight="semibold" color="link">Cancel</Text>
      </Pressable>
      <Pressable
        tag="button"
        type="button"
        :disabled="!send.canSubmit.value || send.busy.value"
        class="flex-1 rounded-full py-3.5 text-center disabled:opacity-50"
        :style="{ backgroundColor: palette.primary }"
        @click="send.submit"
      >
        <Text size="md" weight="semibold" :style="{ color: palette.bg }">{{ submitLabel }}</Text>
      </Pressable>
    </Row>

    <!-- Token picker overlay. -->
    <Box
      v-if="pickerOpen"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      @click="pickerOpen = false"
    >
      <Col
        surface="surface"
        class="w-full max-w-[480px] rounded-t-2xl max-h-[70dvh] overflow-y-auto no-scrollbar p-4"
        @click.stop
      >
        <Text size="xl" weight="semibold" color="link" class="mb-2">Select token</Text>
        <Col v-if="choices.length === 0" align="center" class="py-6">
          <Text size="md" color="secondary">No tokens.</Text>
        </Col>
        <Pressable
          v-for="r in choices"
          :key="`${r.chainId}:${r.symbol}`"
          tag="button"
          type="button"
          class="block w-full text-left active:opacity-60"
          @click="pick(r)"
        >
          <Row align="center" :gap="12" class="py-3">
            <Box class="relative w-8 h-8 shrink-0">
              <Image
                :src="r.logoUrl"
                :size="32"
                radius="full"
                class="bg-metro-border-light dark:bg-metro-border-dark"
              />
              <Box
                class="absolute -right-[3px] -bottom-[3px] w-[18px] h-[18px] rounded-full overflow-hidden
                  border-[2.5px] border-metro-bg-light dark:border-metro-bg-dark
                  bg-metro-border-light dark:bg-metro-border-dark"
              >
                <Image :src="NETWORK_LOGO[r.chainId] ?? MAINNET_NETWORK_LOGO" fit="cover" width="100%" height="100%" />
              </Box>
            </Box>
            <Col class="flex-1 min-w-0" align="start">
              <Text size="md" weight="semibold" color="link" :truncate="true">{{ r.name }}</Text>
              <Text size="xs" color="secondary" :truncate="true">{{ fmtBalance(r.balance) }} {{ r.symbol }}</Text>
            </Col>
          </Row>
        </Pressable>
      </Col>
    </Box>
  </Col>
</template>
