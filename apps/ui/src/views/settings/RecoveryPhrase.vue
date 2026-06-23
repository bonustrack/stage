<script setup lang="ts">

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { mnemonicWords } from '@stage-labs/client/zerodev/derive';
import { getWalletMnemonic, hasWalletMnemonic, markWalletBackedUp } from '../../lib/accounts';

const router = useRouter();
const palette = useKitPalette();

const present = ref(hasWalletMnemonic());
const revealed = ref(false);
const copied = ref(false);
const phrase = ref<string | null>(null);

const words = computed(() => (phrase.value ? mnemonicWords(phrase.value) : []));

function reveal(): void {
  const m = getWalletMnemonic();
  if (!m) {
    present.value = false;
    return;
  }
  phrase.value = m;
  revealed.value = true;
}

function hide(): void {
  revealed.value = false;
  phrase.value = null;
  copied.value = false;
}

async function copy(): Promise<void> {
  if (!phrase.value) return;
  try {
    await navigator.clipboard.writeText(phrase.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { }
}

function done(): void {
  markWalletBackedUp();
  hide();
  router.back();
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
      <Pressable tag="button" type="button" class="p-1" @click="router.back()">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Recovery phrase</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-8">
      <template v-if="!present">
        <Col class="mt-6 rounded-xl border p-4" :style="{ borderColor: palette.border }">
          <Text size="sm" weight="semibold" tag="div" class="text-metro-head-light dark:text-metro-head-dark">
            No recovery phrase yet
          </Text>
          <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark mt-1">
            A recovery phrase is created the first time you add a smart account. Your imported
            keys and other accounts are backed up individually from Manage keys &amp; accounts.
          </Text>
        </Col>
        <Button
          label="Manage keys &amp; accounts"
          variant="soft"
          full-width
          class="mt-4"
          @click="router.push('/accounts')"
        />
      </template>

      <template v-else>
        <Row
          align="start"
          :gap="12"
          class="mt-5 rounded-xl border p-3.5"
          :style="{ borderColor: palette.danger }"
        >
          <Icon name="shieldExclamation" :size="22" :color="palette.danger" />
          <Col class="flex-1 min-w-0">
            <Text size="sm" weight="semibold" :style="{ color: palette.danger }">
              Anyone with this phrase controls your accounts
            </Text>
            <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark mt-0.5">
              Write these words down in order and keep them somewhere safe. This phrase derives
              every smart account in this browser and is stored unencrypted here — never share it,
              screenshot it, or enter it on another site.
            </Text>
          </Col>
        </Row>

        <template v-if="!revealed">
          <Col class="mt-6 items-center rounded-xl border border-dashed p-8" :style="{ borderColor: palette.border }">
            <Icon name="key" :size="28" :color="palette.sub" />
            <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark mt-3 text-center">
              Make sure no one is watching your screen.
            </Text>
          </Col>
          <Button label="Reveal recovery phrase" full-width class="mt-4" @click="reveal" />
        </template>

        <template v-else>
          <ol class="mt-6 grid grid-cols-2 gap-2">
            <li
              v-for="(w, i) in words"
              :key="i"
              class="flex items-center gap-2 rounded-lg border px-3 py-2
                bg-metro-surface-light dark:bg-metro-surface-dark"
              :style="{ borderColor: palette.border }"
            >
              <Text size="2xs" class="w-4 text-right text-metro-sub-light dark:text-metro-sub-dark tabular-nums">{{ i + 1 }}</Text>
              <Text size="sm" weight="semibold" class="font-mono text-metro-head-light dark:text-metro-head-dark">{{ w }}</Text>
            </li>
          </ol>

          <Col :gap="8" class="mt-5">
            <Button
              :label="copied ? 'Copied' : 'Copy to clipboard'"
              variant="soft"
              full-width
              @click="copy"
            />
            <Button label="I've written it down" full-width @click="done" />
            <Button label="Hide" variant="soft" full-width @click="hide" />
          </Col>
        </template>
      </template>
    </Col>
  </Col>
</template>
