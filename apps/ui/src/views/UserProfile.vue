<script setup lang="ts">

import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { resolveSelfAddress } from '../lib/useGroupDetailHelpers';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useQuery } from '@tanstack/vue-query';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { BasicNode, WidgetActionRegistry } from '@stage-labs/kit/kit';
import {
  profileHeader, profileActionsRow, profileAddressRow,
  PROFILE_ROUND_PRESS, PROFILE_ADDRESS_COPY,
} from '@stage-labs/views';

const route = useRoute();
const router = useRouter();
const palette = useKitPalette();
const AVATAR_SIZE = 88;

const address = computed(() => (route.params.address as string) ?? '');
const { data: profile, isSuccess: loaded } = useQuery({
  queryKey: ['profile', computed(() => address.value.toLowerCase())],
  queryFn: () => readProfile(address.value),
  enabled: computed(() => !!address.value),
});
const { data: selfAddress } = useQuery({
  queryKey: ['selfAddress'],
  queryFn: () => resolveSelfAddress(),
});
const notSelf = computed(() =>
  !!address.value
  && address.value.toLowerCase() !== (selfAddress.value ?? '').toLowerCase());

const openingDm = ref(false);

const displayName = computed(() => {
  const trimmed = profile.value?.name?.trim();
  if (trimmed !== undefined && trimmed !== '') return trimmed;
  return address.value ? shortAddress(address.value) : 'Loading…';
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

function onSend(): void {
  void router.push({ path: '/wallet/send', query: { to: address.value } });
}

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

const actionsNode = computed<BasicNode>(() => ({
  type: 'Basic',
  children: [
    profileActionsRow({
      border: palette.border,
      fg: palette.link,
      actions: [
        {
          action: 'message',
          icon: 'chatRect',
          label: openingDm.value ? 'Opening…' : 'Message',
          disabled: openingDm.value,
        },
        { action: 'send', icon: 'send', label: 'Send' },
      ],
    }),
  ],
}));

const registry: WidgetActionRegistry = {
  [PROFILE_ADDRESS_COPY]: () => { void copyAddress(); },
  [PROFILE_ROUND_PRESS]: (action) => {
    if (action.payload.action === 'message') { if (!openingDm.value) void onMessage(); }
    else if (action.payload.action === 'send') onSend();
  },
};
</script>

<template>
  <Col class="min-h-screen" surface="surface">
    <!-- Route header: back button, absolutely positioned over the banner,
         mirroring mobile ProfileScreen ProfileHeader (variant route). -->
    <Row class="flex items-center px-3 py-3 absolute top-0 left-0 right-0 z-20">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" color="link" />
      </Pressable>
    </Row>

    <!-- Banner: 140px tall, border-colored, behind the surface card. -->
    <Col :style="{ height: '140px', backgroundColor: palette.border }" />

    <!-- Identity: avatar overlaps a surface card via negative top margin, with a
         3px bg-color border ring — mirroring mobile ProfileScreen ProfileIdentity
         (surface card margin top -18, avatar 88 marginTop -70.4, borderWidth 3). -->
    <Col
      surface="surface"
      class="px-4 pb-2 items-start"
      :style="{ marginTop: '-18px', borderTopLeftRadius: '18px', borderTopRightRadius: '18px' }"
    >
      <img v-if="loaded"
        :src="avatarRenderUrl(address, profile?.avatar ?? undefined, AVATAR_SIZE * 2)"
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
        <KitRenderer :node="nameNode" />
      </Col>
      <Col v-if="address" class="mt-0.5">
        <KitRenderer :node="addressNode" :registry="registry" />
      </Col>
      <Col v-if="notSelf && address" class="w-full">
        <KitRenderer :node="actionsNode" :registry="registry" />
      </Col>
    </Col>

    <!-- Common channels: mutual group memberships with this peer (not-self only),
         placed below the profile actions to mirror mobile ProfileScreen. -->
    <CommonChannels :peer-address="address" :enabled="notSelf" />
  </Col>
</template>
