<script setup lang="ts">
/** Profile tab — big stamp avatar + wallet + xmtp inbox id. Web build skips the
 *  push-token card (no push on web). */

import { getOrCreateXmtpClient, stampBoxAvatarUrl, shortAddress } from '../lib/xmtp';

const AVATAR_SIZE = 120;

const address = ref('');
const inboxId = ref('');
const copyHint = ref<'address' | 'inboxId' | null>(null);

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    address.value = client.accountIdentifier?.identifier ?? '';
    inboxId.value = client.inboxId ?? '';
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
    <div class="px-4 pt-4 pb-2">
      <h1 class="font-head text-xl text-metro-fg-light dark:text-metro-fg-dark">Profile</h1>
    </div>

    <div class="flex flex-col items-center pt-6 pb-4">
      <img v-if="address"
        :src="stampBoxAvatarUrl(address, AVATAR_SIZE * 2)"
        alt=""
        :width="AVATAR_SIZE" :height="AVATAR_SIZE"
        class="rounded-full bg-metro-border-dark"
      />
      <div v-else class="rounded-full bg-metro-border-dark" :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }" />
      <div class="font-head text-base text-metro-fg-light dark:text-metro-fg-dark mt-3.5">
        {{ address ? shortAddress(address) : 'Loading…' }}
      </div>
    </div>

    <button
      v-if="address"
      type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(address, 'address')"
    >
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        WALLET ADDRESS ({{ copyHint === 'address' ? 'copied!' : 'tap to copy' }})
      </div>
      <div class="text-[13px] font-mono text-metro-fg-light dark:text-metro-fg-dark mt-1 break-all">
        {{ address }}
      </div>
    </button>

    <button
      v-if="inboxId"
      type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-3 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(inboxId, 'inboxId')"
    >
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        XMTP INBOX ID ({{ copyHint === 'inboxId' ? 'copied!' : 'tap to copy' }})
      </div>
      <div class="text-[13px] font-mono text-metro-fg-light dark:text-metro-fg-dark mt-1 truncate">
        {{ inboxId }}
      </div>
    </button>
  </div>
</template>
