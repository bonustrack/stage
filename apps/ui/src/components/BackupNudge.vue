<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, noticeCard, WALLET_NOTICE_PRESS } from '@stage-labs/views';
import { accountEpoch, hasWalletMnemonic, isWalletBackedUp } from '../lib/accounts';

const router = useRouter();
const palette = useKitPalette();

const dismissed = ref(false);

const show = computed(() => {
  void accountEpoch.value;
  return !dismissed.value && hasWalletMnemonic() && !isWalletBackedUp();
});

watch(accountEpoch, () => {
  if (isWalletBackedUp()) dismissed.value = false;
});

function backUp(): void { void router.push('/settings/recovery-phrase'); }
function dismiss(): void { dismissed.value = true; }

const node = computed(() =>
  basicRoot(
    noticeCard({
      icon: 'shieldExclamation',
      iconColor: { light: palette.danger, dark: palette.danger },
      title: 'Back up your recovery phrase',
      titleColor: { light: palette.danger, dark: palette.danger },
      description:
        'Your smart accounts derive from a recovery phrase stored only in this browser. ' +
        'Back it up now or you\'ll lose these accounts if you clear your browser.',
      actions: [
        { label: 'Back up recovery phrase', pressType: WALLET_NOTICE_PRESS, payload: { action: 'backup' } },
        { label: 'Not now', pressType: WALLET_NOTICE_PRESS, variant: 'soft', payload: { action: 'dismiss' } },
      ],
    }),
  ),
);

const actions = {
  [WALLET_NOTICE_PRESS]: (payload: Record<string, unknown>): void => {
    if (payload.action === 'backup') backUp();
    else dismiss();
  },
};
</script>

<template>
  <Col
    v-if="show"
    class="w-[calc(100%-2rem)] mx-4 mt-3 mb-1 shrink-0 rounded-xl border p-3.5"
    :style="{ borderColor: palette.danger }"
  >
    <ViewHost :node="node" :actions="actions" />
  </Col>
</template>
