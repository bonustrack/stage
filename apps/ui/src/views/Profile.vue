<script setup lang="ts">

import { getOrCreateXmtpClient, shortAddress } from '../lib/xmtp';
import { loadCachedProfile, readProfile, type SnapshotProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { BasicNode } from '@stage-labs/kit/kit';
import { profileHeader, profileAddressRow, PROFILE_ADDRESS_COPY } from '@stage-labs/views';

const palette = useKitPalette();
const AVATAR_SIZE = 88;

const address = ref('');
const profile = ref<SnapshotProfile>({});
const loaded = ref(false);

const displayName = computed(() => {
  const trimmed = profile.value.name?.trim();
  if (trimmed !== undefined && trimmed !== '') return trimmed;
  return address.value ? shortAddress(address.value) : 'Loading…';
});

onMounted(async () => {
  try {
    const client = await getOrCreateXmtpClient('production');
    address.value = client.accountIdentifier?.identifier ?? '';
    const cached = address.value ? loadCachedProfile(address.value) : null;
    if (cached) profile.value = cached;
    loaded.value = true;
    if (address.value) {
      const remote = await readProfile(address.value);
      if (remote) profile.value = remote;
    }
  } catch { }
});

async function copyAddress(): Promise<void> {
  if (!address.value) return;
  try {
    await navigator.clipboard.writeText(address.value);
  } catch { }
}

const nameNode = computed<BasicNode>(() => ({
  type: 'Basic',
  children: [profileHeader({ name: displayName.value })],
}));

const addressNode = computed<BasicNode>(() => ({
  type: 'Basic',
  children: [
    profileAddressRow({
      address: address.value,
      label: shortAddress(address.value),
      color: palette.text,
    }),
  ],
}));

const actions = {
  [PROFILE_ADDRESS_COPY]: (): void => { void copyAddress(); },
};
</script>

<template>
  <Col class="min-h-screen" surface="surface">
    <!-- Banner: 140px tall, border-colored, behind the surface card —
         mirroring mobile ProfileScreen ProfileIdentity. -->
    <Col :style="{ height: '140px', backgroundColor: palette.border }" />

    <!-- Identity: avatar overlaps a surface card via negative top margin, with a
         3px bg-color border ring (mobile surface card margin top -18, avatar 88
         marginTop -70.4, borderWidth 3). Self view: no actions, no channels. -->
    <Col
      surface="surface"
      class="px-4 pb-2 items-start"
      :style="{ marginTop: '-18px', borderTopLeftRadius: '18px', borderTopRightRadius: '18px' }"
    >
      <img v-if="address && loaded"
        :src="avatarRenderUrl(address, profile.avatar, AVATAR_SIZE * 2)"
        alt=""
        :style="{
          width: AVATAR_SIZE + 'px', height: AVATAR_SIZE + 'px',
          marginTop: -(AVATAR_SIZE * 0.8) + 'px', zIndex: 1,
          borderWidth: '3px', borderStyle: 'solid', borderColor: palette.bg,
        }"
        class="rounded-full bg-metro-border-light dark:bg-metro-border-dark object-cover"
      />
      <Col v-else
        class="rounded-full bg-metro-border-light dark:bg-metro-border-dark"
        :style="{
          width: AVATAR_SIZE + 'px', height: AVATAR_SIZE + 'px',
          marginTop: -(AVATAR_SIZE * 0.8) + 'px', zIndex: 1,
          borderWidth: '3px', borderStyle: 'solid', borderColor: palette.bg,
        }"
      />
      <Col class="mt-3.5 w-full">
        <ViewHost :node="nameNode" />
      </Col>
      <Col v-if="address" class="mt-0.5">
        <ViewHost :node="addressNode" :actions="actions" />
      </Col>
    </Col>
  </Col>
</template>
