<script setup lang="ts">

import { computed, ref, watch } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, voiceMessage, VOICE_PLAY } from '@stage-labs/views';
import {
  VOICE_BAR_COUNT, voiceWaveformBars, voiceBucketRms,
} from '@stage-labs/client/xmtp/voice';

const props = defineProps<{ src: string }>();

const decoded = ref<number[] | null>(null);
const synthetic = computed(() => voiceWaveformBars(props.src, VOICE_BAR_COUNT));
const bars = computed(() => decoded.value ?? synthetic.value);

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

const node = computed(() =>
  basicRoot(voiceMessage({ src: props.src, bars: bars.value, barCount: VOICE_BAR_COUNT })),
);

const actions = {
  [VOICE_PLAY]: (): void => undefined,
};
</script>

<template>
  <ViewHost :node="node" :actions="actions" />
</template>
