<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from '@/lib/kitTheme';
import { accountEpoch, hasWalletMnemonic, isWalletBackedUp } from '../lib/accounts';

const router = useRouter();
const palette = useKitPalette();
const scheme = useEffectiveScheme();

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
</script>

<template>
  <Col
    v-if="show"
    class="w-[calc(100%-2rem)] mx-4 mt-3 mb-1 shrink-0 rounded-xl border p-3.5"
    :style="{ borderColor: palette.danger }"
  >
    <Row align="start" :gap="12">
      <Icon name="shieldExclamation" :size="22" :color="palette.danger" />
      <Col class="flex-1 min-w-0">
        <Text size="sm" weight="semibold" :style="{ color: palette.danger }">
          Back up your recovery phrase
        </Text>
        <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark mt-0.5">
          Your smart accounts derive from a recovery phrase stored only in this browser. Back it up
          now or you'll lose these accounts if you clear your browser.
        </Text>
      </Col>
    </Row>
    <Col :gap="8" class="mt-3">
      <Button label="Back up recovery phrase" full-width :dark="scheme === 'dark'" @click="backUp" />
      <Button label="Not now" variant="soft" full-width :dark="scheme === 'dark'" @click="dismiss" />
    </Col>
  </Col>
</template>
