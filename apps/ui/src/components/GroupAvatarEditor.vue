<script setup lang="ts">
/** Avatar editor for the group/channel page — large round image, hidden
 *  file input, tap-to-pick. Extracted from GroupDetail.vue to keep that
 *  file under the per-file LOC cap. Calls the parent on file selection;
 *  parent handles the IPFS upload + XMTP `updateImageUrl`. */

import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';

const props = defineProps<{
  imageUrl: string;
  uploading: boolean;
  /** Members who aren't admins can't change the image — show it, no picker. */
  readonly?: boolean;
}>();
const emit = defineEmits<{ (e: 'pick', file: File): void }>();

const input = ref<HTMLInputElement | null>(null);

function pick(): void { input.value?.click(); }

function onChange(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  const file = el.files?.[0];
  el.value = '';
  if (file) emit('pick', file);
}
</script>

<template>
  <div class="flex flex-col items-center pt-1 pb-4">
    <button type="button" :disabled="props.uploading || props.readonly" class="relative" @click="pick">
      <img
        v-if="props.imageUrl"
        :src="avatarRenderUrl('', props.imageUrl, 240)"
        alt=""
        class="w-24 h-24 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark"
        :class="{ 'opacity-50': props.uploading }"
      />
      <div v-else
        class="w-24 h-24 rounded-full flex items-center justify-center
          bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark
          text-metro-sub-light dark:text-metro-sub-dark"
        :class="{ 'opacity-50': props.uploading }"
      ><HeroIcon :name="props.readonly ? 'users' : 'plus'" :size="28" /></div>
    </button>
    <input ref="input" type="file" accept="image/jpeg,image/png" class="hidden" @change="onChange" />
    <div v-if="!props.readonly" class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark mt-1.5 font-sans">
      {{ props.uploading ? 'Uploading…' : 'Tap to change image' }}
    </div>
  </div>
</template>
