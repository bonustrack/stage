<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Hex } from 'viem';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { NETWORK_LABEL } from '@stage-labs/client/wallet/assets';
import { fmtBalance } from '@stage-labs/client/wallet/format';
import { explorerTxUrl } from '@stage-labs/client/xmtp/tx';
import { shortAddress } from '@stage-labs/client/identity/format';
import { getTokenRow } from '../lib/tokenDetailStore';
import { useSend } from '../lib/useSend';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();

const tokenId = computed(() => {
  const t = route.query.token;
  return Array.isArray(t) ? (t[0] ?? '') : (t ?? '');
});
const row = computed(() => (tokenId.value ? getTokenRow(tokenId.value) : null));

const symbolRef = computed(() => row.value?.symbol ?? 'ETH');
const chainIdRef = computed(() => row.value?.chainId ?? 1);
const balanceRef = ref<string | null>(row.value ? row.value.balance : null);

const send = useSend(symbolRef, chainIdRef, balanceRef);

const networkLabel = computed(() => NETWORK_LABEL[chainIdRef.value] ?? `Chain ${chainIdRef.value}`);

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
      <Title size="sm">Send {{ send.symbol.value }}</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar" :gap="16" :padding="{ x: 16, y: 16 }">
      <Box class="self-start rounded-full px-2.5 py-0.5 border" :style="{ borderColor: palette.border }">
        <Text size="xs" color="secondary">{{ networkLabel }}</Text>
      </Box>

      <!-- Recipient -->
      <Col :gap="6">
        <Text size="xs" color="secondary">RECIPIENT</Text>
        <Row
          align="center"
          :gap="6"
          class="rounded-xl border px-3.5"
          :style="{ borderColor: palette.border }"
        >
          <Input
            v-model="send.to.value"
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
            @click="send.onMax"
          >
            <Text size="xs" :color="send.balance.value == null ? 'secondary' : 'link'">MAX</Text>
          </Pressable>
        </Row>
        <Row
          align="center"
          :gap="8"
          class="rounded-xl border px-3.5 py-3"
          :style="{ borderColor: palette.border }"
        >
          <Input
            v-model="send.amount.value"
            placeholder="0.0"
            inputmode="decimal"
            class="flex-1 bg-transparent border-0 outline-none text-xl font-semibold"
          />
          <Text weight="semibold" size="md" color="link">{{ send.symbol.value }}</Text>
        </Row>
        <Text v-if="send.amountErr.value" size="xs" class="px-1" :style="{ color: palette.danger }">
          {{ send.amountErr.value }}
        </Text>
        <Text v-if="send.balance.value != null" size="xs" color="secondary" class="px-1">
          Balance: {{ fmtBalance(send.balance.value) }} {{ send.symbol.value }}
        </Text>
      </Col>

      <!-- Fee preview -->
      <Col
        :gap="6"
        class="rounded-xl border px-3.5 py-3"
        :style="{ borderColor: palette.border }"
      >
        <Row align="center">
          <Text size="xs" color="secondary" class="flex-1">NETWORK FEE</Text>
          <Text size="xs" color="link">
            {{ send.fee.value ? `≈ ${Number(send.fee.value.feeEth).toFixed(6)} ETH` : '—' }}
          </Text>
        </Row>
        <Text v-if="send.feeErr.value" size="xs" color="secondary" class="break-all">
          {{ send.feeErr.value }}
        </Text>
      </Col>

      <Pressable
        tag="button"
        type="button"
        :disabled="!send.canSubmit.value || send.busy.value"
        class="w-full rounded-full py-3.5 mt-2 text-center disabled:opacity-50"
        :style="{ backgroundColor: palette.primary }"
        @click="send.submit"
      >
        <Text size="md" weight="semibold" :style="{ color: palette.bg }">{{ submitLabel }}</Text>
      </Pressable>

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
  </Col>
</template>
