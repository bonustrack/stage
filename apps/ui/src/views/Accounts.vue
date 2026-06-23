<script setup lang="ts">

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import {
  listAccounts, getActiveAccountId,
  addSmartAccount, smartAccountsConfigured,
  switchToAccount, removeAccount,
  shortAddress, stampAvatarUrl, type AccountRecord,
} from '../lib/xmtp';
import { loadPk, canExportPrivateKey } from '../lib/accounts';
import { readProfile, loadCachedProfile } from '../lib/profile';
import AccountImportSheet from '../components/AccountImportSheet.vue';
import AccountExportSheet from '../components/AccountExportSheet.vue';

const router = useRouter();
const palette = useKitPalette();

const TYPE_LABEL: Record<AccountRecord['type'], string> = {
  generated: 'Generated',
  privateKey: 'Imported key',
  walletconnect: 'WalletConnect',
  smart: 'Smart wallet',
};

const accounts = ref<AccountRecord[]>([]);
const activeId = ref<string | null>(null);
const busy = ref(false);
const creating = ref(false);
const error = ref<string | null>(null);

const showImport = ref(false);
const exportPk = ref<string | null>(null);
const manageId = ref<string | null>(null);
const smartReady = smartAccountsConfigured();

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

function manageRec(): AccountRecord | null {
  return accounts.value.find(a => a.id === manageId.value) ?? null;
}
function closeManage(): void { manageId.value = null; }

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
  if (!smartReady) {
    error.value = 'Smart accounts are unavailable — ZeroDev is not configured for this build.';
    return;
  }
  busy.value = true;
  creating.value = true;
  error.value = null;
  try {
    const rec = await addSmartAccount();
    await switchToAccount(rec.id);
    await refresh();
    void router.push('/channels');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    creating.value = false;
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

function onManageSwitch(): void {
  const rec = manageRec();
  closeManage();
  if (rec) void onSwitch(rec.id);
}
function onManageExport(): void {
  const rec = manageRec();
  closeManage();
  if (rec) onExport(rec);
}
function onManageRemove(): void {
  const rec = manageRec();
  closeManage();
  if (rec) void onRemove(rec);
}
function onManageBackup(): void {
  closeManage();
  void router.push('/settings/recovery-phrase');
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
      <!-- Account list + add/import rows mirror mobile AccountList: each row has a
           single ⋯ overflow opening a manage sheet, and dashed-plus rows inside the card. -->
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
              tag="button"
              type="button"
              class="p-1"
              title="Manage account"
              :disabled="busy"
              @click="manageId = a.id"
            >
              <Icon name="dotsHorizontal" :size="20" :color="palette.sub" />
            </Pressable>
          </Row>
        </li>

        <!-- In-card add/import rows with dashed-plus circles, mirroring mobile AddSection. -->
        <li class="border-t" :style="{ borderColor: palette.border }">
          <Pressable
            tag="button"
            type="button"
            class="flex w-full items-center gap-3 px-3.5 py-3 text-left
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :disabled="busy"
            @click="onAdd"
          >
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full"
              :class="creating ? '' : 'border border-dashed'"
              :style="creating ? {} : { borderColor: palette.sub }"
            >
              <Spinner v-if="creating" :size="18" class="text-metro-head-light dark:text-metro-head-dark" />
              <Icon v-else name="plus" :size="16" :color="palette.sub" />
            </span>
            <Col :gap="1" class="min-w-0">
              <Text size="md" weight="semibold" class="text-metro-head-light dark:text-metro-head-dark">
                {{ creating ? 'Creating smart wallet…' : 'Add account' }}
              </Text>
              <Text size="xs" role="secondary">
                {{ creating
                  ? 'Setting up your smart account — this can take a moment'
                  : smartReady ? 'Creates a smart wallet' : 'Smart wallet unavailable — ZeroDev not configured' }}
              </Text>
            </Col>
          </Pressable>
        </li>
        <li class="border-t" :style="{ borderColor: palette.border }">
          <Pressable
            tag="button"
            type="button"
            class="flex w-full items-center gap-3 px-3.5 py-3 text-left
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :disabled="busy"
            @click="showImport = true"
          >
            <span
              class="flex h-7 w-7 items-center justify-center rounded-full border border-dashed"
              :style="{ borderColor: palette.sub }"
            >
              <Icon name="key" :size="14" :color="palette.sub" />
            </span>
            <Text size="md" weight="semibold" class="text-metro-head-light dark:text-metro-head-dark">
              Import account
            </Text>
          </Pressable>
        </li>
      </ul>

      <Text v-if="error" class="px-4 mt-3 text-[12px]" :style="{ color: '#ef4444' }">{{ error }}</Text>

      <Text class="px-4 mt-4 text-[11px]" role="secondary">
        Tap an account to switch, or ⋯ for options. Private keys are stored unencrypted in this browser —
        only import keys you are comfortable keeping here.
      </Text>
    </Col>

    <!-- Per-row manage sheet — mirrors mobile ManageSheet (Switch / Export / Remove). -->
    <Row
      v-if="manageId"
      class="fixed inset-0 z-40 flex items-end bg-black/45"
      @click.self="closeManage"
    >
      <Col
        class="w-full rounded-t-2xl px-4 pt-3 pb-7 border-t bg-metro-surface-light dark:bg-metro-surface-dark"
        :style="{ borderColor: palette.border }"
      >
        <Col class="mx-auto mb-3 h-1 w-9 rounded-full" :style="{ backgroundColor: palette.border }" />
        <Col
          class="rounded-xl overflow-hidden border"
          :style="{ borderColor: palette.border }"
        >
          <Pressable
            v-if="manageRec() && manageRec()!.id !== activeId"
            tag="button"
            type="button"
            class="w-full text-left px-4 py-3.5
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            @click="onManageSwitch"
          >
            <Text size="md" weight="medium" class="text-metro-head-light dark:text-metro-head-dark">
              Switch to this account
            </Text>
          </Pressable>
          <Pressable
            v-if="manageRec() && canExportPrivateKey(manageRec()!)"
            tag="button"
            type="button"
            class="w-full text-left px-4 py-3.5 border-t
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :style="{ borderColor: palette.border }"
            @click="onManageExport"
          >
            <Col :gap="2">
              <Text size="md" weight="medium" class="text-metro-head-light dark:text-metro-head-dark">
                Export private key
              </Text>
              <Text size="xs" role="secondary">Reveal + copy this account's key</Text>
            </Col>
          </Pressable>
          <Pressable
            v-if="manageRec() && manageRec()!.type === 'smart'"
            tag="button"
            type="button"
            class="w-full text-left px-4 py-3.5 border-t
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :style="{ borderColor: palette.border }"
            @click="onManageBackup"
          >
            <Col :gap="2">
              <Text size="md" weight="medium" class="text-metro-head-light dark:text-metro-head-dark">
                Back up recovery phrase
              </Text>
              <Text size="xs" role="secondary">Smart accounts derive from your recovery phrase</Text>
            </Col>
          </Pressable>
          <Pressable
            tag="button"
            type="button"
            class="w-full text-left px-4 py-3.5 border-t
              hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
            :style="{ borderColor: palette.border }"
            @click="onManageRemove"
          >
            <Col :gap="2">
              <Text size="md" weight="medium" :style="{ color: palette.danger }">Remove account</Text>
              <Text size="xs" role="secondary">Delete from this browser</Text>
            </Col>
          </Pressable>
        </Col>
      </Col>
    </Row>

    <AccountImportSheet v-if="showImport" @close="showImport = false" @imported="onImported" />
    <AccountExportSheet v-if="exportPk" :private-key="exportPk" @close="exportPk = null" />
  </Col>
</template>
