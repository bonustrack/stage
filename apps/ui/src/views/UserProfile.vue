<script setup lang="ts">

import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { readProfile } from '../lib/profile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { useQuery } from '@tanstack/vue-query';

const route = useRoute();
const router = useRouter();
const AVATAR_SIZE = 120;

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
    <Col class="px-6 pb-8">
      <Col class="flex flex-col items-center pt-2">
        <img v-if="loaded"
          :src="avatarRenderUrl(address, profile?.avatar ?? undefined, AVATAR_SIZE * 2)"
          alt=""
          :style="{ width: AVATAR_SIZE + 'px', height: AVATAR_SIZE + 'px' }"
          class="rounded-full bg-metro-border-dark object-cover"
        />
        <Col v-else class="rounded-full bg-metro-border-dark" :style="{ width: AVATAR_SIZE + 'px', height: AVATAR_SIZE + 'px' }" />
        <Col class="mt-3 text-lg font-head text-metro-head-light dark:text-metro-head-dark">
          {{ profile?.name?.trim() || shortAddress(address) }}
        </Col>
        <Col v-if="profile?.about?.trim()"
          class="mt-1 text-sm text-metro-sub-light dark:text-metro-sub-dark text-center max-w-prose">
          {{ profile.about }}
        </Col>
        <Pressable
          tag="button"
          type="button"
          :disabled="openingDm"
          class="mt-4 px-6 py-2.5 rounded-full
            bg-metro-head-light dark:bg-metro-head-dark text-metro-bg-light dark:text-metro-bg-dark
            text-[18px] disabled:opacity-60 hover:opacity-90 transition-opacity"
          @click="onMessage"
        >
          {{ openingDm ? 'Opening…' : 'Message' }}
        </Pressable>
      </Col>

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
