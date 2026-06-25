<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { noticeCard, WALLET_NOTICE_PRESS } from '@stage-labs/views';
import { basicRoot } from '@/lib/chatkitRow';
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

const registry: WidgetActionRegistry = {
  [WALLET_NOTICE_PRESS]: (action) => {
    if (action.payload.action === 'backup') backUp();
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
    <ChatKitRenderer :node="node" :registry="registry" />
  </Col>
</template>
