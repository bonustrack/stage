<script setup lang="ts">

const props = defineProps<{ videoId: string }>();
const watchUrl = computed(() => `https://www.youtube.com/watch?v=${props.videoId}`);
const thumbUrl = computed(() => `https://i.ytimg.com/vi/${props.videoId}/hqdefault.jpg`);

function open(): void { window.open(watchUrl.value, '_blank', 'noopener'); }
</script>

<template>
  <MediaCard :on-press="open">
    <div class="relative aspect-video bg-black">
      <img :src="thumbUrl" :alt="`YouTube video ${props.videoId}`" class="w-full h-full object-cover" />
      <div class="absolute inset-0 flex items-center justify-center bg-black/25">
        <div class="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center text-white text-xl pl-0.5">
          ▶
        </div>
      </div>
    </div>
    <div class="px-2.5 py-1.5 text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
      YouTube
    </div>
  </MediaCard>
</template>
