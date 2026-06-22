<script setup lang="ts">

import { getOrCreateXmtpClient, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile, type SnapshotProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';

const AVATAR_SIZE = 88;

const address = ref('');
const inboxId = ref('');
const profile = ref<SnapshotProfile>({});
const loaded = ref(false);
const copyHint = ref<'address' | 'inboxId' | null>(null);

const displayName = computed(() => {
  const trimmed = profile.value.name?.trim();
  if (trimmed !== undefined && trimmed !== '') return trimmed;
  return address.value ? shortAddress(address.value) : 'Loading…';
});

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    address.value = client.accountIdentifier?.identifier ?? '';
    inboxId.value = client.inboxId ?? '';
    const cached = address.value ? loadCachedProfile(address.value) : null;
    if (cached) profile.value = cached;
    loaded.value = true;
    if (address.value) {
      const remote = await readProfile(address.value);
      if (remote) profile.value = remote;
    }
  } catch { }
});

async function copy(value: string, label: 'address' | 'inboxId'): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copyHint.value = label;
    setTimeout(() => { copyHint.value = null; }, 1500);
  } catch { }
}
</script>

<template>
  <Col class="min-h-screen">
    <Row class="flex items-center justify-between px-4 pt-4 pb-2">
      <Title :level="1" class="font-head text-xl text-metro-head-light dark:text-metro-head-dark">Profile</Title>
    </Row>

    <Col class="flex flex-col items-center pt-6 pb-4">
      <img v-if="address && loaded"
        :src="avatarRenderUrl(address, profile.avatar, AVATAR_SIZE * 2)"
        alt=""
        :width="AVATAR_SIZE" :height="AVATAR_SIZE"
        class="rounded-full bg-metro-border-dark object-cover"
        :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }"
      />
      <Col v-else class="rounded-full bg-metro-border-dark" :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }" />
      <Text size="4xl" weight="semibold" class="mt-3.5 text-metro-head-light dark:text-metro-head-dark">
        {{ displayName }}
      </Text>
      <Col v-if="profile.about"
        class="text-[13px] text-metro-sub-light dark:text-metro-sub-dark mt-1.5 px-6 text-center max-w-md">
        {{ profile.about }}
      </Col>
    </Col>

    <Pressable
      tag="button"
      v-if="address" type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-2 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(address, 'address')"
    >
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        WALLET ADDRESS ({{ copyHint === 'address' ? 'copied!' : 'tap to copy' }})
      </Col>
      <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-1 break-all">
        {{ address }}
      </Col>
    </Pressable>

    <Pressable
      tag="button"
      v-if="inboxId" type="button"
      class="block w-[calc(100%-2rem)] mx-4 mt-3 p-3 rounded-xl text-left
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark"
      @click="copy(inboxId, 'inboxId')"
    >
      <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
        XMTP INBOX ID ({{ copyHint === 'inboxId' ? 'copied!' : 'tap to copy' }})
      </Col>
      <Col class="text-[13px] text-metro-fg-light dark:text-metro-fg-dark mt-1 truncate">
        {{ inboxId }}
      </Col>
    </Pressable>
  </Col>
</template>
