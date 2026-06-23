<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { listAccounts, getActiveAccountId, loadPk, canExportPrivateKey, hasWalletMnemonic, type AccountRecord } from '../../lib/accounts';

const router = useRouter();
const palette = useKitPalette();

const account = ref<AccountRecord | null>(null);
const hasLocalKey = ref(false);
const hasMnemonic = ref(hasWalletMnemonic());

onMounted(async () => {
  try {
    const [list, active] = await Promise.all([listAccounts(), getActiveAccountId()]);
    const acc = list.find(a => a.id === active) ?? list[0] ?? null;
    account.value = acc;
    if (acc && canExportPrivateKey(acc)) hasLocalKey.value = loadPk(acc.id) != null;
  } catch { }
});
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
      <Title size="sm">Security</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <BackupNudge />
      <!-- Unencrypted-key warning: the web build keeps wallet keys in the browser's
           localStorage with no OS keychain / biometric gate (mobile's SecureWalletNudge
           equivalent). Honest, web-appropriate state in place of biometrics. -->
      <Col
        v-if="hasLocalKey"
        class="w-[calc(100%-2rem)] mx-4 mt-5 rounded-xl border p-3.5"
        :style="{ borderColor: palette.danger }"
      >
        <Row align="center" :gap="12">
          <Icon name="shieldExclamation" :size="22" :color="palette.danger" />
          <Col class="flex-1 min-w-0">
            <Text size="sm" weight="semibold" :style="{ color: palette.danger }">Key stored unencrypted</Text>
            <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark mt-0.5">
              This account's private key lives in browser storage without a passcode or biometric lock. Back up your key and avoid using Stage on shared devices.
            </Text>
          </Col>
        </Row>
      </Col>

      <!-- ACCOUNT SECURITY: key management entry point, mirroring mobile's
           AccountSecuritySection. Links to the Accounts screen for export / backup. -->
      <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ACCOUNT SECURITY</Text>
      <Pressable
        tag="button"
        type="button"
        class="w-[calc(100%-2rem)] mx-4 mt-2 flex items-center gap-3 px-4 py-3.5 rounded-xl border
          bg-metro-surface-light dark:bg-metro-surface-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
        :style="{ borderColor: palette.border }"
        @click="router.push('/accounts')"
      >
        <Icon name="key" :size="22" :color="palette.text" />
        <Col class="flex-1 min-w-0 text-left">
          <Text size="xl" tag="div" class="text-metro-head-light dark:text-metro-head-dark">Manage keys &amp; accounts</Text>
          <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">Import, export and switch accounts.</Text>
        </Col>
        <Icon name="chevronRight" :size="18" :color="palette.sub" />
      </Pressable>

      <!-- RECOVERY PHRASE: back up the BIP-39 mnemonic every smart account derives
           from (mobile's SecureWalletNudge "Back up recovery phrase" equivalent). -->
      <Pressable
        tag="button"
        type="button"
        class="w-[calc(100%-2rem)] mx-4 mt-3 flex items-center gap-3 px-4 py-3.5 rounded-xl border
          bg-metro-surface-light dark:bg-metro-surface-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark transition-colors"
        :style="{ borderColor: palette.border }"
        @click="router.push('/settings/recovery-phrase')"
      >
        <Icon name="shieldExclamation" :size="22" :color="palette.text" />
        <Col class="flex-1 min-w-0 text-left">
          <Text size="xl" tag="div" class="text-metro-head-light dark:text-metro-head-dark">Recovery phrase</Text>
          <Text size="2xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark">
            {{ hasMnemonic ? 'Back up the phrase your smart accounts derive from.' : 'Available once you create a smart account.' }}
          </Text>
        </Col>
        <Icon name="chevronRight" :size="18" :color="palette.sub" />
      </Pressable>
    </Col>
  </Col>
</template>
