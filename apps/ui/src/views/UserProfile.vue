<script setup lang="ts">

import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { resolveSelfAddress } from '../lib/useGroupDetailHelpers';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useQuery } from '@tanstack/vue-query';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type {
  BasicNode, ListViewItemNode, ListViewNode, WidgetActionRegistry,
} from '@stage-labs/kit/kit';
import {
  profileHeader, infoRow, PROFILE_ACTION_PRESS, PROFILE_INFO_PRESS,
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
const copied = ref(false);

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
      name: nonEmpty(profile.value?.name) ?? shortAddress(address.value),
      handle: shortAddress(address.value),
      bio: nonEmpty(profile.value?.about),
      actions: notSelf.value
        ? [
            {
              label: openingDm.value ? 'Opening…' : 'Message',
              icon: 'chatRect',
              payload: { kind: 'message' },
            },
            { label: 'Send', icon: 'send', payload: { kind: 'send' } },
          ]
        : undefined,
    }),
  ],
}));

const headerRegistry: WidgetActionRegistry = {
  [PROFILE_ACTION_PRESS]: (action) => {
    if (action.payload.kind === 'message' || action.payload.kind === 'send') {
      void onMessage();
    }
  },
};

const profileLinks = computed<[string, string | undefined][]>(() => {
  const p = profile.value;
  return [
    ['GitHub', nonEmpty(p?.github)],
    ['X (Twitter)', nonEmpty(p?.twitter)],
    ['Lens', nonEmpty(p?.lens)],
    ['Farcaster', nonEmpty(p?.farcaster)],
  ];
});

const infoNode = computed<ListViewNode>(() => {
  const items: ListViewItemNode[] = [];
  if (address.value) {
    items.push(infoRow({
      label: `Wallet address (${copied.value ? 'copied!' : 'tap to copy'})`,
      value: address.value,
      copyType: PROFILE_INFO_PRESS,
    }));
  }
  for (const [label, val] of profileLinks.value) {
    if (val !== undefined) items.push(infoRow({ label, value: val }));
  }
  return { type: 'ListView', children: items };
});

const infoRegistry: WidgetActionRegistry = {
  [PROFILE_INFO_PRESS]: (action) => {
    const value = action.payload.value;
    if (typeof value === 'string') void copy(value);
  },
};
</script>

<template>
  <Col class="min-h-screen bg-metro-bg-light dark:bg-metro-bg-dark">
    <Row class="flex items-center px-3 py-3">
      <Pressable tag="button" type="button" class="p-1.5" @click="router.back()">
        <Icon name="arrowLeft" :size="22" />
      </Pressable>
    </Row>
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
        <KitRenderer :node="headerNode" :registry="headerRegistry" />
      </Col>
    </Col>

    <!-- Common channels: mutual group memberships with this peer (not-self only),
         placed below the profile actions to mirror mobile ProfileScreen. -->
    <CommonChannels :peer-address="address" :enabled="notSelf" />

    <Col class="px-6 pb-8">
      <Col class="mt-6">
        <KitRenderer :node="infoNode" :registry="infoRegistry" />
      </Col>
    </Col>
  </Col>
</template>
