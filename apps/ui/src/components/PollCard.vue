<script setup lang="ts">

import { computed } from 'vue';
import { normalizeQuestions, type PollContent } from '@stage-labs/client/xmtp/poll';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { basicRoot, pollCard, type PollQuestion, POLL_OPTION_PRESS } from '@stage-labs/views';

const props = defineProps<{
  poll: PollContent;
  votes?: Map<number, Map<number, Set<string>>>;
  ownVotes?: Map<number, Set<number>>;
}>();
interface VotePayload { questionIndex: number; optionIndex: number; action: 'added' | 'removed' }
const emit = defineEmits<{ vote: [payload: VotePayload] }>();

const questions = computed(() => normalizeQuestions(props.poll));

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

const model = computed<PollQuestion[]>(() =>
  questions.value.map((q, qi) => ({
    question: q.question,
    header: q.header ?? undefined,
    multiSelect: q.multiSelect,
    total: totalFor(qi),
    options: q.options.map((opt, oi) => ({
      label: opt.label,
      votes: votersFor(qi, oi),
      pct: pctFor(qi, oi),
      selected: isOn(qi, oi),
    })),
  })),
);

const node = computed(() =>
  basicRoot(pollCard({ questions: model.value, dispatchPress: true })),
);

const actions = {
  [POLL_OPTION_PRESS]: (payload: Record<string, unknown>): void => {
    const qi = payload.questionIndex;
    const oi = payload.optionIndex;
    if (typeof qi !== 'number' || typeof oi !== 'number') return;
    emit('vote', {
      questionIndex: qi,
      optionIndex: oi,
      action: isOn(qi, oi) ? 'removed' : 'added',
    });
  },
};
</script>

<template>
  <ViewHost :node="node" :actions="actions" />
</template>
