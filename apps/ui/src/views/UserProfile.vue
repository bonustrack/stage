<script setup lang="ts">

import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useQuery } from '@tanstack/vue-query';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';

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
      <Col class="mt-3.5 text-[20px] font-head font-semibold text-metro-head-light dark:text-metro-head-dark">
        {{ profile?.name?.trim() || shortAddress(address) }}
      </Col>
      <Col class="mt-0.5 text-[15px] text-metro-fg-light dark:text-metro-fg-dark">
        {{ shortAddress(address) }}
      </Col>
      <Col v-if="profile?.about?.trim()"
        class="mt-1 text-sm text-metro-sub-light dark:text-metro-sub-dark max-w-prose">
        {{ profile.about }}
      </Col>

      <!-- Two icon-actions (Message + Send), variant=secondary size=xl (56px),
           icon 22 + label below (md 15px semibold link), gap 12, mirroring
           mobile ProfileActions. -->
      <Row class="mt-[18px]" :gap="12" justify="start">
        <Col align="center" :gap="6">
          <Button
            variant="secondary"
            size="xl"
            pill
            :tint-bg="palette.border"
            :disabled="openingDm"
            @click="onMessage"
          >
            <Icon name="chatRect" :size="22" :color="palette.link" />
          </Button>
          <span class="text-[15px] font-semibold" :style="{ color: palette.link }">
            {{ openingDm ? 'Opening…' : 'Message' }}
          </span>
        </Col>
        <Col align="center" :gap="6">
          <Button
            variant="secondary"
            size="xl"
            pill
            :tint-bg="palette.border"
            @click="onMessage"
          >
            <Icon name="send" :size="22" :color="palette.link" />
          </Button>
          <span class="text-[15px] font-semibold" :style="{ color: palette.link }">Send</span>
        </Col>
      </Row>
    </Col>

    <Col class="px-6 pb-8">
      <Col class="mt-6 space-y-2">
        <Pressable
          tag="button"
          type="button"
          class="w-full text-left p-3 rounded-xl border
            border-metro-border-light dark:border-metro-border-dark
            bg-metro-surface-light dark:bg-metro-surface-dark"
          @click="copy(address)"
        >
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">
            Wallet address ({{ copied ? 'copied!' : 'tap to copy' }})
          </Col>
          <Col class="text-sm mt-1 break-all font-mono">{{ address }}</Col>
        </Pressable>
        <Col v-if="profile?.github?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">GitHub</Col>
          <Col class="text-sm mt-1">{{ profile.github }}</Col>
        </Col>
        <Col v-if="profile?.twitter?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">X (Twitter)</Col>
          <Col class="text-sm mt-1">{{ profile.twitter }}</Col>
        </Col>
        <Col v-if="profile?.lens?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">Lens</Col>
          <Col class="text-sm mt-1">{{ profile.lens }}</Col>
        </Col>
        <Col v-if="profile?.farcaster?.trim()" class="p-3 rounded-xl border border-metro-border-light dark:border-metro-border-dark bg-metro-surface-light dark:bg-metro-surface-dark">
          <Col class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark uppercase tracking-wide">Farcaster</Col>
          <Col class="text-sm mt-1">{{ profile.farcaster }}</Col>
        </Col>
      </Col>
    </Col>
  </Col>
</template>
