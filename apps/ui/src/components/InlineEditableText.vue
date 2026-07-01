<script setup lang="ts">

import { computed, ref, watchEffect } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { composeField } from '@/lib/composeField';
import { metroFieldColors } from '@/lib/metroFieldColors';
import { basicRoot } from '@stage-labs/views';

const props = withDefaults(defineProps<{
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  saving?: boolean;
  emptyLabel?: string;
  readonly?: boolean;
  valueClass?: string;
}>(), {
  placeholder: '',
  multiline: false,
  saving: false,
  emptyLabel: 'Tap to edit',
  readonly: false,
  valueClass: 'text-xl text-metro-head-light dark:text-metro-head-dark font-head',
});
const emit = defineEmits<(e: 'save', next: string) => void>();

const editing = ref(false);
const draft = ref(props.value);
watchEffect(() => { if (!editing.value) draft.value = props.value; });

function onSave(): void {
  emit('save', draft.value.trim());
}

const DRAFT_CHANGE = 'inlineEdit.draft.change';

const editNode = computed(() =>
  basicRoot(composeField({
    name: 'draft',
    value: draft.value,
    placeholder: props.placeholder,
    fontSize: props.multiline ? 14 : 16,
    multiline: props.multiline,
    rows: props.multiline ? 3 : undefined,
    textColor: metroFieldColors.fg,
    autoFocus: true,
    changeType: DRAFT_CHANGE,
  })));

const editActions = {
  [DRAFT_CHANGE]: (payload: Record<string, unknown>): void => {
    const next = payload.draft;
    if (typeof next === 'string') draft.value = next;
  },
};
</script>

<template>
  <Col>
    <Col class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">{{ props.label }}</Col>
    <Col v-if="props.readonly" class="mt-1.5">
      <Col v-if="props.value.trim()" :class="props.valueClass">{{ props.value.trim() }}</Col>
      <Col v-else class="text-sm text-metro-sub-light dark:text-metro-sub-dark font-sans">{{ props.emptyLabel }}</Col>
    </Col>
    <Row v-else-if="editing" class="flex items-start gap-2 mt-1.5">
      <Col class="flex-1 min-w-0">
        <ViewHost :node="editNode" :actions="editActions" />
      </Col>
      <Pressable
        tag="button"
        type="button"
        :disabled="props.saving"
        class="px-3.5 py-2 rounded-full bg-metro-head-light dark:bg-metro-head-dark
          text-metro-bg-light dark:text-metro-bg-dark text-sm disabled:opacity-50"
        @click="onSave"
      >
        {{ props.saving ? 'Saving…' : 'Save' }}
      </Pressable>
    </Row>
    <Pressable v-else tag="button" type="button" class="mt-1.5 block text-left" @click="editing = true">
      <Col :class="props.value.trim() ? props.valueClass : 'text-sm text-metro-sub-light dark:text-metro-sub-dark font-sans'">
        {{ props.value.trim() || props.emptyLabel }}
      </Col>
      <Col v-if="props.value.trim()"
        class="text-xs text-metro-sub-light dark:text-metro-sub-dark mt-0.5 font-sans">
        Tap to edit
      </Col>
    </Pressable>
  </Col>
</template>
