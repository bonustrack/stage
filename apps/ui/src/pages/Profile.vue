<script setup lang="ts">
/** Profile tab — wallet identity + Snapshot-hub profile (display name, bio,
 *  custom avatar, socials). Tap Edit to open the EIP-712 update sheet. */

import { getOrCreateXmtpClient, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile, type SnapshotProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/metro-client/profile/snapshot';

const AVATAR_SIZE = 120;

const address = ref('');
const inboxId = ref('');
const profile = ref<SnapshotProfile>({});
const loaded = ref(false);
const editing = ref(false);
const copyHint = ref<'address' | 'inboxId' | null>(null);

const displayName = computed(() =>
  profile.value.name?.trim() || (address.value ? shortAddress(address.value) : 'Loading…'),
);

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    address.value = client.accountIdentifier?.identifier ?? '';
    inboxId.value = client.inboxId ?? '';
    const cached = loadCachedProfile();
    if (cached) profile.value = cached;
    loaded.value = true;
    if (address.value) {
      const remote = await readProfile(address.value);
      if (remote) profile.value = remote;
    }
  } catch { /* leave fields blank */ }
});

async function copy(value: string, label: 'address' | 'inboxId'): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copyHint.value = label;
    setTimeout(() => { copyHint.value = null; }, 1500);
  } catch { /* no clipboard permission */ }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <h1 class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Profile</h1>
      <button
        v-if="address" type="button"
        class="font-head text-sm text-metro-head-light dark:text-metro-head-dark"
        @click="editing = true"
      >Edit</button>
    </div>

    <div class="flex flex-col items-center pt-6 pb-4">
      <img v-if="address && loaded"
        :src="avatarRenderUrl(address, profile.avatar, AVATAR_SIZE * 2)"
        alt=""
        :width="AVATAR_SIZE" :height="AVATAR_SIZE"
        class="rounded-full bg-metro-border-dark object-cover"
        :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }"
      />
      <div v-else class="rounded-full bg-metro-border-dark" :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }" />
      <div class="font-head text-lg text-metro-head-light dark:text-metro-head-dark mt-3.5">
        {{ displayName }}
      </div>
      <div v-if="profile.about"
        class="text-[13px] text-metro-sub-light dark:text-metro-sub-dark mt-1.5 px-6 text-center max-w-md">
        {{ profile.about }}
      </div>
    </div>

    <button
      v-if="address" type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(address, 'address')"
    >
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        WALLET ADDRESS ({{ copyHint === 'address' ? 'copied!' : 'tap to copy' }})
      </div>
      <div class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-1 break-all">
        {{ address }}
      </div>
    </button>

    <button
      v-if="inboxId" type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-3 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(inboxId, 'inboxId')"
    >
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        XMTP INBOX ID ({{ copyHint === 'inboxId' ? 'copied!' : 'tap to copy' }})
      </div>
      <div class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-1 truncate">
        {{ inboxId }}
      </div>
    </button>

    <EditProfileModal
      :open="editing" :address="address" :initial="profile"
      @close="editing = false"
      @saved="next => profile = next"
    />
  </div>
</template>
