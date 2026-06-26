<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import { accountRow, ACCOUNT_PRESS } from '@stage-labs/views';
import { listAccounts, getActiveAccount, accountEpoch, type AccountRecord } from '../lib/accounts';
import { switchToAccount, stampAvatarUrl, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile } from '../lib/profile';

const router = useRouter();

const accounts = ref<AccountRecord[]>([]);
const activeId = ref<string | null>(null);
const open = ref(false);
const names = ref<Record<string, string>>({});

function nameFor(address: string): string | null {
  return names.value[address.toLowerCase()] ?? null;
}

function label(a: AccountRecord): string {
  return a.label ?? nameFor(a.address) ?? shortAddress(a.address);
}

const activeAccount = computed(() => accounts.value.find((a) => a.id === activeId.value) ?? null);
const activeAddress = computed(() => activeAccount.value?.address ?? '');
const activeName = computed(() => (activeAccount.value ? label(activeAccount.value) : ''));
const activeAvatar = computed(() => (activeAddress.value ? stampAvatarUrl(activeAddress.value, 56) : ''));

async function resolveName(address: string): Promise<void> {
  const lower = address.toLowerCase();
  if (names.value[lower]) return;
  const cached = loadCachedProfile(address);
  if (cached?.name) names.value = { ...names.value, [lower]: cached.name };
  const p = await readProfile(address);
  if (p?.name) names.value = { ...names.value, [lower]: p.name };
}

async function refresh(): Promise<void> {
  accounts.value = await listAccounts();
  activeId.value = (await getActiveAccount())?.id ?? null;
  for (const a of accounts.value) void resolveName(a.address);
}

watch(accountEpoch, () => { void refresh(); }, { immediate: true });

async function onSwitch(id: string): Promise<void> {
  if (id === activeId.value) { open.value = false; return; }
  try {
    await switchToAccount(id);
    activeId.value = id;
  } finally {
    open.value = false;
  }
}

function goManage(): void {
  open.value = false;
  void router.push('/accounts');
}

const listNode = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: accounts.value.map((a) =>
    accountRow({
      accountId: a.id,
      avatarUri: stampAvatarUrl(a.address, 56),
      name: label(a),
      address: shortAddress(a.address),
      typeLabel: a.id === activeId.value ? 'Active' : undefined,
    }),
  ),
}));

const registry: WidgetActionRegistry = {
  [ACCOUNT_PRESS]: (action) => {
    const id = action.payload.accountId;
    if (typeof id === 'string') void onSwitch(id);
  },
};
</script>

<template>
  <Pressable
    tag="button"
    type="button"
    class="flex items-center gap-2 -mx-1 px-1 rounded-lg hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
    title="Accounts"
    @click="open = true"
  >
    <AvatarView :src="activeAvatar" :size="28" />
    <Text
      v-if="activeName"
      size="4xl"
      weight="semibold"
      :truncate="true"
      class="max-w-[200px] text-metro-head-light dark:text-metro-head-dark"
    >
      {{ activeName }}
    </Text>
  </Pressable>

  <template v-if="open">
    <Col class="fixed inset-0 z-40 bg-black/30" @click="open = false" />
    <Col
      class="fixed left-2 top-[52px] z-50 min-w-[240px] py-1 rounded-lg shadow-lg
        bg-metro-bg-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
    >
      <KitRenderer :node="listNode" :registry="registry" />

      <Col class="border-t border-metro-border-light dark:border-metro-border-dark my-1" />

      <Pressable
        tag="button"
        type="button"
        class="w-full flex items-center gap-3 text-left px-3 py-2.5 text-sm
          text-metro-head-light dark:text-metro-head-dark
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
        @click="goManage"
      >
        <Icon name="cog" :size="20" />
        Manage accounts
      </Pressable>
    </Col>
  </template>
</template>
