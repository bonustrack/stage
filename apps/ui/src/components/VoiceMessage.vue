<script setup lang="ts">

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  VOICE_BAR_COUNT, formatVoiceDuration, voiceWaveformBars, voiceBucketRms,
} from '@stage-labs/client/xmtp/voice';

const props = defineProps<{ src: string }>();

const ACCENT = '#0a7cff';
const ON_ACCENT = '#ffffff';

const audio = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const position = ref(0);
const duration = ref(0);
const decoded = ref<number[] | null>(null);

const synthetic = computed(() => voiceWaveformBars(props.src, VOICE_BAR_COUNT));
const bars = computed(() => decoded.value ?? synthetic.value);
const progress = computed(() => (duration.value > 0 ? Math.min(position.value / duration.value, 1) : 0));
const label = computed(() =>
  playing.value || position.value > 0 ? formatVoiceDuration(position.value * 1000) : formatVoiceDuration(duration.value * 1000),
);

watch(() => props.src, () => { void decodeBars(); }, { immediate: true });

async function decodeBars(): Promise<void> {
  decoded.value = null;
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const buf = await (await fetch(props.src)).arrayBuffer();
    const ctx = new Ctx();
    const audioBuf = await ctx.decodeAudioData(buf);
    const pcm = audioBuf.getChannelData(0);
    decoded.value = voiceBucketRms(pcm, VOICE_BAR_COUNT);
    void ctx.close().catch(() => undefined);
  } catch { decoded.value = null; }
}

function toggle(): void {
  const el = audio.value;
  if (!el) return;
  if (el.paused) void el.play().catch(() => undefined);
  else el.pause();
}

function onTime(): void {
  const el = audio.value;
  if (!el) return;
  position.value = el.currentTime;
  if (Number.isFinite(el.duration)) duration.value = el.duration;
}

function onEnded(): void { playing.value = false; position.value = 0; }

function seek(ev: MouseEvent): void {
  const el = audio.value;
  if (!el || duration.value <= 0) return;
  const target = ev.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  el.currentTime = fraction * duration.value;
  position.value = el.currentTime;
}

onBeforeUnmount(() => { audio.value?.pause(); });
</script>

<template>
  <Row
    class="items-center gap-2.5 rounded-2xl px-2.5 py-1.5 max-w-[280px] min-w-[200px]"
    :style="{ backgroundColor: ACCENT }"
  >
    <audio
      ref="audio"
      :src="props.src"
      preload="metadata"
      class="hidden"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="onTime"
      @loadedmetadata="onTime"
      @ended="onEnded"
    />
    <Pressable
      tag="button"
      type="button"
      class="w-[34px] h-[34px] shrink-0 rounded-full flex items-center justify-center"
      :style="{ backgroundColor: ON_ACCENT }"
      :title="playing ? 'Pause' : 'Play'"
      @click="toggle"
    >
      <Icon :name="playing ? 'pause' : 'play'" :size="18" :color="ACCENT" />
    </Pressable>
    <Pressable
      tag="button"
      type="button"
      class="flex-1 h-[26px] flex items-center gap-[2px] cursor-pointer bg-transparent border-0 p-0"
      @click="seek"
    >
      <span
        v-for="(h, i) in bars"
        :key="i"
        class="flex-1 rounded-[1px]"
        :style="{
          height: `${Math.max(3, h * 26)}px`,
          backgroundColor: ON_ACCENT,
          opacity: i / bars.length <= progress ? 1 : 0.45,
        }"
      />
    </Pressable>
    <span class="text-xs min-w-[34px] text-right font-sans" :style="{ color: ON_ACCENT }">{{ label }}</span>
  </Row>
</template>
