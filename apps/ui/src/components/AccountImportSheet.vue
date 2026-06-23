<script setup lang="ts">

import { computed, ref } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from '../lib/kitTheme';
import { importFromSeed, importPrivateKey, restoreWalletMnemonic, smartAccountsConfigured } from '../lib/xmtp';

const emit = defineEmits<{ close: []; imported: [] }>();

const palette = useKitPalette();
const scheme = useEffectiveScheme();
const dark = computed(() => scheme.value === 'dark');

const mode = ref<'seed' | 'privateKey'>('seed');
const seed = ref('');
const pk = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

async function submit(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    if (mode.value === 'seed') {
      const phrase = seed.value.trim();
      if (smartAccountsConfigured()) await restoreWalletMnemonic(phrase);
      else await importFromSeed(phrase);
    } else await importPrivateKey(pk.value.trim());
    emit('imported');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <!-- Bottom-sheet overlay mirrors mobile SheetModal. -->
  <Row class="fixed inset-0 z-40 flex items-end bg-black/45" @click.self="emit('close')">
    <Col
      class="w-full rounded-t-2xl px-4 pt-3 pb-7 border-t bg-metro-surface-light dark:bg-metro-surface-dark"
      :style="{ borderColor: palette.border }"
    >
      <Col class="mx-auto mb-3 h-1 w-9 rounded-full" :style="{ backgroundColor: palette.border }" />

      <Title size="sm" class="mb-1">Import account</Title>

      <!-- SECURITY WARNING: keys are persisted in plaintext in this browser. -->
      <Row
        align="start"
        :gap="8"
        class="mb-3 rounded-lg p-3"
        :style="{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }"
      >
        <Icon name="shieldExclamation" :size="18" :color="'#ef4444'" />
        <Text class="text-[12px] leading-snug" :style="{ color: '#ef4444' }">
          Private keys are stored <strong>unencrypted</strong> in this browser. Anyone with access to this
          device — or any malicious script (XSS) — can read them. Do not import high-value keys here, and
          always keep your own backup.
        </Text>
      </Row>

      <Row :gap="8" class="mb-3">
        <Button
          :label="'Recovery phrase'"
          :variant="mode === 'seed' ? 'solid' : 'soft'"
          size="sm"
          :dark="dark"
          @click="mode = 'seed'"
        />
        <Button
          :label="'Private key'"
          :variant="mode === 'privateKey' ? 'solid' : 'soft'"
          size="sm"
          :dark="dark"
          @click="mode = 'privateKey'"
        />
      </Row>

      <Textarea
        v-if="mode === 'seed'"
        v-model="seed"
        :rows="3"
        :dark="dark"
        placeholder="Enter your 12–24 word recovery phrase"
      />
      <Input
        v-else
        v-model="pk"
        :dark="dark"
        placeholder="0x… 64-character private key"
      />

      <Text v-if="error" class="mt-2 text-[12px]" :style="{ color: '#ef4444' }">{{ error }}</Text>

      <Col :gap="8" class="mt-4">
        <Button
          label="Import"
          :loading="busy"
          :disabled="mode === 'seed' ? !seed.trim() : !pk.trim()"
          :dark="dark"
          full-width
          @click="submit"
        />
        <Button label="Cancel" variant="soft" :dark="dark" full-width @click="emit('close')" />
      </Col>
    </Col>
  </Row>
</template>
