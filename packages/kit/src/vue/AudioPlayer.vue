<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useKitScheme } from './theme-context';

const props = withDefaults(
  defineProps<{
    src: string;
    duration?: number;
    dark?: boolean;
    waveform?: boolean;
    bars?: number[];
    barCount?: number;
    accent?: string;
    onAccent?: string;
  }>(),
  {},
);

const emit = defineEmits<{ play: [] }>();

const scheme = useKitScheme();
const isDark = computed(() => props.dark ?? scheme === 'dark');

const accent = computed(() => props.accent ?? '#0a7cff');
const onAccent = computed(() => props.onAccent ?? '#ffffff');

const audio = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const position = ref(0);
const duration = ref(0);

const bars = computed(() =>
  props.bars && props.bars.length > 0
    ? props.bars
    : new Array<number>(props.barCount ?? 34).fill(0.5),
);
const progress = computed(() =>
  duration.value > 0 ? Math.min(position.value / duration.value, 1) : 0,
);

function fmt(ms: number): string {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const label = computed(() =>
  playing.value || position.value > 0
    ? fmt(position.value * 1000)
    : fmt((props.duration ?? 0) * 1000 || duration.value * 1000),
);

function toggle(): void {
  const el = audio.value;
  if (!el) return;
  if (el.paused) {
    emit('play');
    void el.play().catch(() => undefined);
  } else el.pause();
}

function onTime(): void {
  const el = audio.value;
  if (!el) return;
  position.value = el.currentTime;
  if (Number.isFinite(el.duration)) duration.value = el.duration;
}

function onEnded(): void {
  playing.value = false;
  position.value = 0;
}

function seek(ev: MouseEvent): void {
  const el = audio.value;
  if (!el || duration.value <= 0) return;
  const target = ev.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
  el.currentTime = fraction * duration.value;
  position.value = el.currentTime;
}

const wrapStyle = computed<Record<string, string>>(() => ({
  padding: '10px',
  borderRadius: '12px',
  backgroundColor: isDark.value ? '#1c1c1e' : '#f0f0f2',
}));

onBeforeUnmount(() => {
  audio.value?.pause();
});
</script>

<template>
  <Row v-if="props.waveform" class="items-center gap-2.5 flex-1">
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
      :style="{ backgroundColor: onAccent }"
      :title="playing ? 'Pause' : 'Play'"
      @click="toggle"
    >
      <Icon :name="playing ? 'pause' : 'play'" :size="18" :color="accent" />
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
          backgroundColor: onAccent,
          opacity: i / bars.length <= progress ? 1 : 0.45,
        }"
      />
    </Pressable>
    <span class="text-xs min-w-[34px] text-right font-sans" :style="{ color: onAccent }">{{ label }}</span>
  </Row>
  <div v-else :style="wrapStyle">
    <audio
      :src="src"
      controls
      preload="metadata"
      :style="{ width: '100%', height: '36px' }"
      @play="emit('play')"
    />
  </div>
</template>
