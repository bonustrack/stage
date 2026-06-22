<script setup lang="ts">

import { computed } from 'vue';
import { normalizeQuestions, type PollContent } from '@stage-labs/client/xmtp/poll';

const props = defineProps<{
  poll: PollContent;
  votes?: Map<number, Map<number, Set<string>>>;
  ownVotes?: Map<number, Set<number>>;
}>();
interface VotePayload { questionIndex: number; optionIndex: number; action: 'added' | 'removed' }
const emit = defineEmits<{ vote: [payload: VotePayload] }>();

const questions = computed(() => normalizeQuestions(props.poll));
const multiQuestion = computed(() => questions.value.length > 1);

function votersFor(qi: number, oi: number): number {
  return props.votes?.get(qi)?.get(oi)?.size ?? 0;
}
function totalFor(qi: number): number {
  const q = questions.value[qi];
  if (!q) return 0;
  return q.options.reduce((n, _o, i) => n + votersFor(qi, i), 0);
}
function pctFor(qi: number, oi: number): number {
  const total = totalFor(qi);
  return total > 0 ? Math.round((votersFor(qi, oi) / total) * 100) : 0;
}
function isOn(qi: number, oi: number): boolean {
  return props.ownVotes?.get(qi)?.has(oi) ?? false;
}
function tap(qi: number, oi: number): void {
  emit('vote', { questionIndex: qi, optionIndex: oi, action: isOn(qi, oi) ? 'removed' : 'added' });
}
</script>

<template>
  <Col class="mt-2 gap-3 self-stretch">
    <Col v-for="(q, qi) in questions" :key="`q-${qi}`" class="gap-1.5 self-stretch">
      <Text v-if="multiQuestion && qi > 0" size="3xl" weight="semibold"
        class="text-metro-head-light dark:text-metro-head-dark">{{ q.question }}</Text>
      <Text v-if="qi === 0" size="3xl" weight="semibold"
        class="text-metro-head-light dark:text-metro-head-dark">{{ q.question }}</Text>
      <Text v-if="q.header" size="xs" weight="semibold"
        class="uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">
        {{ q.header }}{{ q.multiSelect ? ' · multi-select' : '' }}
      </Text>
      <Pressable
        tag="button"
        v-for="(opt, oi) in q.options"
        :key="`o-${oi}-${opt.label}`"
        type="button"
        class="relative overflow-hidden flex flex-row items-center justify-between gap-2
          px-3 py-2 rounded-lg border text-left"
        :class="isOn(qi, oi)
          ? 'border-metro-link-light dark:border-metro-link-dark bg-metro-link-light/15 dark:bg-metro-link-dark/20'
          : 'border-metro-border-light dark:border-metro-border-dark hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark'"
        @click="tap(qi, oi)"
      >
        <Col class="absolute left-0 top-0 bottom-0 pointer-events-none
            bg-metro-link-light/10 dark:bg-metro-link-dark/15"
          :style="{ width: `${pctFor(qi, oi)}%` }" />
        <span class="relative z-10 flex-1 min-w-0 truncate font-sans text-[17px]
          text-metro-head-light dark:text-metro-head-dark">
          <template v-if="isOn(qi, oi)">✓ </template>
          <template v-else-if="q.multiSelect">☐ </template>{{ opt.label }}
        </span>
        <span class="relative z-10 shrink-0 text-sm font-semibold tabular-nums
          text-metro-sub-light dark:text-metro-sub-dark">
          {{ pctFor(qi, oi) }}% · {{ votersFor(qi, oi) }}
        </span>
      </Pressable>
      <Text v-if="q.options.length > 0" size="xs"
        class="text-metro-sub-light dark:text-metro-sub-dark">
        {{ totalFor(qi) }} vote{{ totalFor(qi) === 1 ? '' : 's' }}
      </Text>
    </Col>
  </Col>
</template>
