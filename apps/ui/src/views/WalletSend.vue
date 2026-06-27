<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Hex } from 'viem';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import {
  sendFields, sendReviewList, screenHeader, SCREEN_BACK,
  WALLET_SEND_FIELD_CHANGE, WALLET_SEND_FIELD_ACTION,
} from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { NETWORK_LABEL, NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { fmtBalance } from '@stage-labs/client/wallet/format';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useWalletBalances } from '@/lib/useWalletBalances';
import { buildSortedTokenRows } from '@stage-labs/client/wallet/tokens';
import { getTokenRow } from '../lib/tokenDetailStore';
import { useSend } from '../lib/useSend';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();

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

const headerNode = computed(() =>
  basicRoot(screenHeader({
    title: 'Send token',
    titleStyle: { kind: 'title', size: 'sm' },
    backColor: palette.text,
    safeTop: 0,
    padTop: 10,
    surface: palette.toolbarBg,
    borderColor: palette.border,
  })),
);

const fieldsNode = computed(() =>
  basicRoot(sendFields({
    recipient: send.to.value,
    resolving: send.resolving.value,
    resolvedText: send.resolved.value ? shortAddress(send.resolved.value) : undefined,
    recipientError: send.resolveErr.value ?? undefined,
    amount: send.amount.value,
    unitLabel: mode.value === 'token' ? send.symbol.value : 'USD',
    secondaryLabel: secondaryLabel.value || undefined,
    amountError: send.amountErr.value ?? undefined,
    balanceLabel: send.balance.value != null
      ? `Balance: ${fmtBalance(send.balance.value)} ${send.symbol.value}`
      : undefined,
    maxDisabled: send.balance.value == null,
  })));

const feeNode = computed(() => {
  const fee = send.fee.value;
  const value = fee
    ? (fee.sponsored ? 'Gas sponsored' : `≈ ${Number(fee.feeEth).toFixed(6)} ETH`)
    : '—';
  return basicRoot(sendReviewList([{ label: 'Network fee', value }]));
});

const fieldsRegistry: WidgetActionRegistry = {
  [SCREEN_BACK]: () => { back(); },
  [WALLET_SEND_FIELD_CHANGE]: (action) => {
    if (action.payload.field === 'recipient' && typeof action.payload.recipient === 'string') {
      send.to.value = action.payload.recipient;
    } else if (action.payload.field === 'amount' && typeof action.payload.amount === 'string') {
      send.amount.value = action.payload.amount;
    }
  },
  [WALLET_SEND_FIELD_ACTION]: (action) => {
    if (action.payload.action === 'max') { mode.value = 'token'; send.onMax(); }
    else if (action.payload.action === 'toggleUnit') toggleMode();
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <KitRenderer :node="headerNode" :registry="fieldsRegistry" />

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

      <!-- Recipient + amount inputs via Kit TextField nodes. -->
      <KitRenderer :node="fieldsNode" :registry="fieldsRegistry" />

      <!-- Network fee row via sendReviewList. -->
      <KitRenderer :node="feeNode" :registry="fieldsRegistry" />
      <Text v-if="send.feeErr.value" size="xs" color="secondary" class="px-1 break-all">
        {{ send.feeErr.value }}
      </Text>

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
