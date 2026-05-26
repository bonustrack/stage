<script setup lang="ts">
/** Read-only public profile view for a peer's Ethereum address. Opened from
 *  any avatar tap or "open profile" search suggestion. Mirrors the Profile
 *  tab layout but without edit controls; adds a Message button that
 *  find-or-creates the DM and routes to the conversation. */

import { openDmWithAddress, shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { getCacheHash, type SnapshotProfile } from '@shared/profile/snapshot';

const route = useRoute();
const router = useRouter();
const AVATAR_SIZE = 120;

const address = computed(() => (route.params.address as string) ?? '');
const profile = ref<SnapshotProfile | null>(null);
const openingDm = ref(false);
const copied = ref(false);

watchEffect(async () => {
  const addr = address.value;
  if (!addr) return;
  profile.value = null;
  const p = await readProfile(addr).catch(() => null);
  profile.value = p;
});

async function onMessage(): Promise<void> {
  if (!address.value || openingDm.value) return;
  openingDm.value = true;
  try {
    const convId = await openDmWithAddress(address.value);
    void router.replace(`/xmtp/${convId}`);
  } catch (e) {
    console.warn('openDmWithAddress failed', (e as Error).message);
  } finally { openingDm.value = false; }
}

async function copy(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch { /* no clipboard */ }
}
</script>

<template>
  <div class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <div class="flex items-center px-3 py-3">
      <button type="button" class="p-1.5" @click="router.back()">
        <HeroIcon name="arrowLeft" :size="22" />
      </button>
    </div>
    <div class="px-6 pb-8">
      <div class="flex flex-col items-center pt-2">
        <img
          :src="stampBoxAvatarUrl(address, AVATAR_SIZE * 2, getCacheHash(profile?.avatar))"
          alt=""
          :style="{ width: AVATAR_SIZE + 'px', height: AVATAR_SIZE + 'px' }"
          class="rounded-full bg-metro-border-dark"
        />
        <div class="mt-3 text-lg font-head text-metro-head-light dark:text-metro-head-dark">
          {{ profile?.name?.trim() || shortAddress(address) }}
        </div>
        <div v-if="profile?.about?.trim()"
          class="mt-1 text-sm text-metro-sub-light dark:text-metro-sub-dark text-center max-w-prose">
          {{ profile.about }}
        </div>
        <button
          type="button"
          :disabled="openingDm"
          class="mt-4 px-6 py-2.5 rounded-full
            bg-metro-head-light dark:bg-metro-head-dark text-metro-bg-light dark:text-metro-bg-dark
            text-[18px] disabled:opacity-60 hover:opacity-90 transition-opacity"
          @click="onMessage"
        >
          {{ openingDm ? 'Opening…' : 'Message' }}
        </button>
      </div>

      <div class="mt-6 space-y-2">
        <button
          type="button"
          class="w-full text-left p-3 rounded-xl border
            border-metro-border-light dark:border-metro-border-dark
            bg-metro-surface-light dark:bg-metro-surface-dark"
          @click="copy(address)"
        >
          <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">
            Wallet address ({{ copied ? 'copied!' : 'tap to copy' }})
          </div>
          <div class="text-sm mt-1 break-all font-mono">{{ address }}</div>
        </button>
        <div v-if="profile?.github?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">GitHub</div>
          <div class="text-sm mt-1">{{ profile.github }}</div>
        </div>
        <div v-if="profile?.twitter?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">X (Twitter)</div>
          <div class="text-sm mt-1">{{ profile.twitter }}</div>
        </div>
        <div v-if="profile?.lens?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">Lens</div>
          <div class="text-sm mt-1">{{ profile.lens }}</div>
        </div>
        <div v-if="profile?.farcaster?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">Farcaster</div>
          <div class="text-sm mt-1">{{ profile.farcaster }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
