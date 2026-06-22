<script setup lang="ts">

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useEffectiveScheme } from '../lib/kitTheme';
import {
  listAccounts, getActiveAccountId, addGeneratedAccount,
  switchToAccount, removeAccount,
  shortAddress, stampAvatarUrl, type AccountRecord,
} from '../lib/xmtp';
import { loadPk, canExportPrivateKey } from '../lib/accounts';
import { readProfile, loadCachedProfile } from '../lib/profile';
import AccountImportSheet from '../components/AccountImportSheet.vue';
import AccountExportSheet from '../components/AccountExportSheet.vue';

const router = useRouter();
const palette = useKitPalette();
const scheme = useEffectiveScheme();

const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
  smart: 'Smart wallet',
};

const accounts = ref<AccountRecord[]>([]);
const activeId = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const showImport = ref(false);
const exportPk = ref<string | null>(null);

const peerNames = ref<Record<string, string>>({});
function peerName(address: string): string | null {
  return peerNames.value[address.toLowerCase()] ?? null;
}
function resolvePeerName(address: string): void {
  const lower = address.toLowerCase();
  if (peerNames.value[lower]) return;
  const cached = loadCachedProfile(address)?.name;
  if (cached) peerNames.value = { ...peerNames.value, [lower]: cached };
  void readProfile(address).then((p) => {
    if (p?.name) peerNames.value = { ...peerNames.value, [lower]: p.name };
  });
}

async function refresh(): Promise<void> {
  const [list, active] = await Promise.all([listAccounts(), getActiveAccountId()]);
  accounts.value = list;
  activeId.value = active;
  for (const a of list) resolvePeerName(a.address);
}

onMounted(() => { void refresh(); });

async function onSwitch(id: string): Promise<void> {
  if (id === activeId.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await switchToAccount(id);
    await refresh();
    void router.push('/channels');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function onAdd(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const rec = await addGeneratedAccount();
    await switchToAccount(rec.id);
    await refresh();
    void router.push('/channels');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

function onExport(rec: AccountRecord): void {
  if (!canExportPrivateKey(rec)) return;
  const pk = loadPk(rec.id);
  if (!pk) {
    error.value = 'This account has no exportable private key.';
    return;
  }
  exportPk.value = pk;
}

async function onRemove(rec: AccountRecord): Promise<void> {
  if (busy.value) return;
  const exportable = canExportPrivateKey(rec);
  const warn = `Remove ${rec.label ?? shortAddress(rec.address)}? Its local data will be deleted from this browser.${
    exportable ? ' Export and back up the private key first — once removed it cannot be recovered.' : ''
  }`;
  if (!confirm(warn)) return;
  busy.value = true;
  error.value = null;
  try {
    const wasActive = rec.id === activeId.value;
    await removeAccount(rec.id);
    await refresh();
    if (wasActive) void router.push('/channels');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

function onImported(): void {
  showImport.value = false;
  void refresh();
}
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <!-- Toolbar header mirrors the mobile Accounts screen title bar. -->
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
      <Title size="sm">Accounts</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6">
      <!-- Account list: each row mirrors mobile AccountRow (avatar, name, type, active check). -->
      <ul
        class="w-[calc(100%-2rem)] mx-4 mt-4 rounded-xl overflow-hidden border bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <li v-if="accounts.length === 0" class="px-4 py-4">
          <Text role="secondary">No accounts yet.</Text>
        </li>
        <li
          v-for="(a, i) in accounts"
          :key="a.id"
          :class="i === 0 ? '' : 'border-t'"
          :style="i === 0 ? {} : { borderColor: palette.border }"
        >
          <Row
            align="center"
            :gap="12"
            class="px-3.5 py-3"
            :style="a.id === activeId ? { backgroundColor: palette.border } : {}"
          >
            <Pressable
              tag="button"
              type="button"
              class="flex flex-1 min-w-0 items-center gap-3 text-left"
              :disabled="busy"
              @click="onSwitch(a.id)"
            >
              <AvatarView :src="stampAvatarUrl(a.address, 56)" :size="28" />
              <span class="flex flex-col min-w-0 flex-1">
                <Text size="md" weight="semibold" :truncate="true"
                  class="text-metro-head-light dark:text-metro-head-dark">
                  {{ a.label ?? peerName(a.address) ?? shortAddress(a.address) }}
                </Text>
                <Text size="xs" :truncate="true"
                  class="text-metro-sub-light dark:text-metro-sub-dark">
                  {{ shortAddress(a.address) }} · {{ TYPE_LABEL[a.type] }}
                </Text>
              </span>
            </Pressable>
            <Icon v-if="a.id === activeId" name="check" :size="20" :color="palette.text" />
            <Pressable
              v-if="canExportPrivateKey(a)"
              tag="button"
              type="button"
              class="p-1"
              title="Export private key"
              :disabled="busy"
              @click="onExport(a)"
            >
              <Icon name="key" :size="18" :color="palette.sub" />
            </Pressable>
            <Pressable
              tag="button"
              type="button"
              class="p-1"
              title="Remove account"
              :disabled="busy"
              @click="onRemove(a)"
            >
              <Icon name="trash" :size="18" :color="palette.sub" />
            </Pressable>
          </Row>
        </li>
      </ul>

      <!-- Add / import actions mirror mobile's "Add account" row + import sheet entry. -->
      <Col class="w-[calc(100%-2rem)] mx-4 mt-4" :gap="10">
        <Button label="Add account" :loading="busy" :dark="scheme === 'dark'" full-width @click="onAdd" />
        <Button
          label="Import account"
          variant="soft"
          :disabled="busy"
          :dark="scheme === 'dark'"
          full-width
          @click="showImport = true"
        />
      </Col>

      <Text v-if="error" class="px-4 mt-3 text-[12px]" :style="{ color: '#ef4444' }">{{ error }}</Text>

      <Text class="px-4 mt-4 text-[11px]" role="secondary">
        Tap an account to switch. Private keys are stored unencrypted in this browser — only import keys
        you are comfortable keeping here.
      </Text>
    </Col>

    <AccountImportSheet v-if="showImport" @close="showImport = false" @imported="onImported" />
    <AccountExportSheet v-if="exportPk" :private-key="exportPk" @close="exportPk = null" />
  </Col>
</template>
