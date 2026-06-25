<script setup lang="ts">

import { getOrCreateXmtpClient, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile, type SnapshotProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type {
  BasicNode, ListViewItemNode, ListViewNode, WidgetActionRegistry,
} from '@stage-labs/kit/kit';
import { profileHeader, infoRow, PROFILE_INFO_PRESS } from '@stage-labs/views';

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

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : undefined;
}

const headerNode = computed<BasicNode>(() => ({
  type: 'Basic',
  children: [
    profileHeader({
      name: displayName.value,
      bio: nonEmpty(profile.value.about),
      align: 'center',
    }),
  ],
}));

const infoNode = computed<ListViewNode>(() => {
  const items: ListViewItemNode[] = [];
  if (address.value) {
    items.push(infoRow({
      label: `WALLET ADDRESS (${copyHint.value === 'address' ? 'copied!' : 'tap to copy'})`,
      value: address.value,
      copyType: PROFILE_INFO_PRESS,
      payload: { kind: 'address' },
    }));
  }
  if (inboxId.value) {
    items.push(infoRow({
      label: `XMTP INBOX ID (${copyHint.value === 'inboxId' ? 'copied!' : 'tap to copy'})`,
      value: inboxId.value,
      copyType: PROFILE_INFO_PRESS,
      payload: { kind: 'inboxId' },
    }));
  }
  return { type: 'ListView', children: items };
});

const infoRegistry: WidgetActionRegistry = {
  [PROFILE_INFO_PRESS]: (action) => {
    const value = action.payload.value;
    const kind = action.payload.kind;
    if (typeof value === 'string' && (kind === 'address' || kind === 'inboxId')) {
      void copy(value, kind);
    }
  },
};
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
      <Col class="mt-3.5 w-full px-6 items-center">
        <KitRenderer :node="headerNode" />
      </Col>
    </Col>

    <Col class="w-[calc(100%-2rem)] mx-4 mt-2">
      <KitRenderer :node="infoNode" :registry="infoRegistry" />
    </Col>
  </Col>
</template>
