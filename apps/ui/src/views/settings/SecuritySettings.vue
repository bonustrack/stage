<script setup lang="ts">

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { settingsHeader, settingsNavRow, SCREEN_BACK, SETTINGS_NAV_PRESS } from '@stage-labs/views';
import { listAccounts, getActiveAccountId, loadPk, canExportPrivateKey, hasWalletMnemonic, type AccountRecord } from '../../lib/accounts';

const router = useRouter();
const palette = useKitPalette();

const headerNode = computed(() => settingsHeader({
  title: 'Security',
  backColor: palette.text,
  surface: palette.toolbarBg,
  borderColor: palette.border,
  safeTop: 0,
}));

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

const manageNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'Manage keys & accounts',
    value: 'Import, export and switch accounts.',
    iconStart: 'key',
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: '/accounts' },
  })],
}));

const recoveryNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'Recovery phrase',
    value: hasMnemonic.value
      ? 'Back up the phrase your smart accounts derive from.'
      : 'Available once you create a smart account.',
    iconStart: 'shieldExclamation',
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: '/settings/recovery-phrase' },
  })],
}));

const registry: WidgetActionRegistry = {
  [SCREEN_BACK]: () => { router.back(); },
  [SETTINGS_NAV_PRESS]: (action) => {
    const to = action.payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <KitRenderer :node="headerNode" :registry="registry" />

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

      <Text size="3xs" tag="div" class="text-metro-sub-light dark:text-metro-sub-dark px-4 pt-6 pb-1">ACCOUNT SECURITY</Text>
      <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
        <KitRenderer :node="manageNode" :registry="registry" />
      </Col>
      <Col class="w-[calc(100%-2rem)] mx-4 mt-3">
        <KitRenderer :node="recoveryNode" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
