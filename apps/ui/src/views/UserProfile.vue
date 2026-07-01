<script setup lang="ts">

import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { resolveSelfAddress } from '../lib/useGroupDetailHelpers';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useQuery } from '@tanstack/vue-query';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ViewHost from '@stage-labs/kit/vue/view-host';
import type { BasicNode } from '@stage-labs/kit/kit';
import {
  basicRoot, profileHeader, profileActionsRow, profileAddressRow, screenHeader,
  PROFILE_ROUND_PRESS, PROFILE_ADDRESS_COPY, SCREEN_BACK,
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

const headerNode = computed<BasicNode>(() => basicRoot(screenHeader({
  variant: 'overlay',
  backColor: palette.link,
  backHitSlop: 10,
  backPadding: 6,
})));

const actions = {
  [PROFILE_ADDRESS_COPY]: (): void => { void copyAddress(); },
  [PROFILE_ROUND_PRESS]: (payload: Record<string, unknown>): void => {
    if (payload.action === 'message') { if (!openingDm.value) void onMessage(); }
    else if (payload.action === 'send') onSend();
  },
  [SCREEN_BACK]: (): void => { router.back(); },
};
</script>

<template>
  <Col class="min-h-screen" surface="surface">
    <!-- Route header: back button, absolutely positioned over the banner,
         mirroring mobile ProfileScreen ProfileHeader (variant route). -->
    <ViewHost :node="headerNode" :actions="actions" />

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
        <ViewHost :node="nameNode" />
      </Col>
      <Col v-if="address" class="mt-0.5">
        <ViewHost :node="addressNode" :actions="actions" />
      </Col>
      <Col v-if="notSelf && address" class="w-full">
        <ViewHost :node="actionsNode" :actions="actions" />
      </Col>
    </Col>

    <!-- Common channels: mutual group memberships with this peer (not-self only),
         placed below the profile actions to mirror mobile ProfileScreen. -->
    <CommonChannels :peer-address="address" :enabled="notSelf" />
  </Col>
</template>
