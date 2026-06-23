<script setup lang="ts">

import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { listAccounts, getActiveAccount, accountEpoch, type AccountRecord } from '../lib/accounts';
import { switchToAccount, stampAvatarUrl, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile } from '../lib/profile';

const router = useRouter();

const accounts = ref<AccountRecord[]>([]);
const activeId = ref<string | null>(null);
const open = ref(false);
const switching = ref<string | null>(null);
const names = ref<Record<string, string>>({});

function nameFor(address: string): string | null {
  return names.value[address.toLowerCase()] ?? null;
}

function label(a: AccountRecord): string {
  return a.label ?? nameFor(a.address) ?? shortAddress(a.address);
}

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
  switching.value = id;
  try {
    await switchToAccount(id);
    activeId.value = id;
    open.value = false;
  } finally {
    switching.value = null;
  }
}

function goManage(): void {
  open.value = false;
  void router.push('/accounts');
}
</script>

<template>
  <Pressable
    tag="button"
    type="button"
    class="p-1 rounded-full hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark"
    title="Accounts"
    @click="open = true"
  >
    <AvatarView
      :src="activeId ? stampAvatarUrl((accounts.find((a) => a.id === activeId)?.address) ?? '', 56) : ''"
      :size="28"
    />
  </Pressable>

  <template v-if="open">
    <Col class="fixed inset-0 z-40 bg-black/30" @click="open = false" />
    <Col
      class="fixed left-2 top-[52px] z-50 min-w-[240px] py-1 rounded-lg shadow-lg
        bg-metro-bg-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
    >
      <Pressable
        v-for="a in accounts"
        :key="a.id"
        tag="button"
        type="button"
        :disabled="switching !== null"
        class="w-full flex items-center gap-3 text-left px-3 py-2.5
          hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark disabled:opacity-50"
        @click="onSwitch(a.id)"
      >
        <AvatarView :src="stampAvatarUrl(a.address, 56)" :size="30" />
        <Col class="flex-1 min-w-0">
          <Text size="md" weight="semibold" :truncate="true"
            class="text-metro-head-light dark:text-metro-head-dark">
            {{ label(a) }}
          </Text>
          <Text size="xs" :truncate="true" class="text-metro-sub-light dark:text-metro-sub-dark">
            {{ shortAddress(a.address) }}
          </Text>
        </Col>
        <Icon v-if="a.id === activeId" name="check" :size="20"
          class="text-metro-head-light dark:text-metro-head-dark" />
      </Pressable>

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
