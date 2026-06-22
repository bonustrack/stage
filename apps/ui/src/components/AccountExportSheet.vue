<script setup lang="ts">

import { computed, ref } from 'vue';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from '../lib/kitTheme';

const props = defineProps<{ privateKey: string }>();
const emit = defineEmits<{ close: [] }>();

const palette = useKitPalette();
const scheme = useEffectiveScheme();
const dark = computed(() => scheme.value === 'dark');

const revealed = ref(false);
const copied = ref(false);

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.privateKey);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch { copied.value = false; }
}
</script>

<template>
  <!-- Bottom-sheet overlay mirrors mobile ExportSheet. -->
  <Row class="fixed inset-0 z-40 flex items-end bg-black/45" @click.self="emit('close')">
    <Col
      class="w-full rounded-t-2xl px-4 pt-3 pb-7 border-t bg-metro-surface-light dark:bg-metro-surface-dark"
      :style="{ borderColor: palette.border }"
    >
      <Col class="mx-auto mb-3 h-1 w-9 rounded-full" :style="{ backgroundColor: palette.border }" />

      <Title size="sm" class="mb-1">Export private key</Title>

      <!-- SECURITY WARNING: reveal exposes full account control; keys live in plaintext here. -->
      <Row
        align="start"
        :gap="8"
        class="mb-3 rounded-lg p-3"
        :style="{ backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }"
      >
        <Icon name="shieldExclamation" :size="18" :color="'#ef4444'" />
        <Text class="text-[12px] leading-snug" :style="{ color: '#ef4444' }">
          Anyone with this key has <strong>full control</strong> of the account — never share it. This key is
          stored <strong>unencrypted</strong> in this browser; back it up somewhere safe before removing the
          account, as removal cannot be undone.
        </Text>
      </Row>

      <Col
        v-if="revealed"
        class="mb-3 rounded-lg p-3 break-all font-mono text-[12px] leading-relaxed"
        :style="{ border: `1px solid ${palette.border}`, color: palette.text }"
      >
        {{ privateKey }}
      </Col>
      <Button
        v-else
        label="Reveal private key"
        variant="soft"
        :dark="dark"
        full-width
        class="mb-3"
        @click="revealed = true"
      />

      <Col :gap="8">
        <Button
          :label="copied ? 'Copied!' : 'Copy to clipboard'"
          :disabled="!revealed"
          :dark="dark"
          full-width
          @click="copy"
        />
        <Button label="Done" variant="soft" :dark="dark" full-width @click="emit('close')" />
      </Col>
    </Col>
  </Row>
</template>
