<script setup lang="ts">
/** Inline-editable text field — used for both the group name (single line)
 *  and the group description (multiline). Click the value to switch to
 *  edit mode; Save commits and emits to the parent. */

const props = withDefaults(defineProps<{
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  saving?: boolean;
  emptyLabel?: string;
  /** Tailwind classes applied to the rendered value when not editing.
   *  Lets the parent pick a heading size for `name` vs body size for
   *  `description` without forking the component. */
  valueClass?: string;
}>(), {
  placeholder: '',
  multiline: false,
  saving: false,
  emptyLabel: 'Tap to edit',
  valueClass: 'text-xl text-metro-fg-light dark:text-metro-fg-dark font-head',
});
const emit = defineEmits<{ (e: 'save', next: string): void }>();

const editing = ref(false);
const draft = ref(props.value);
watchEffect(() => { if (!editing.value) draft.value = props.value; });

function onSave(): void {
  emit('save', draft.value.trim());
}
</script>

<template>
  <div>
    <div class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">{{ props.label }}</div>
    <div v-if="editing" class="flex items-start gap-2 mt-1.5">
      <textarea
        v-if="props.multiline"
        v-model="draft"
        :placeholder="props.placeholder"
        rows="3"
        autofocus
        class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark
          rounded-lg px-3 py-2 text-sm text-metro-fg-light dark:text-metro-fg-dark
          outline-none resize-none font-sans"
      />
      <input
        v-else
        v-model="draft"
        type="text"
        :placeholder="props.placeholder"
        autofocus
        class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark
          rounded-lg px-3 py-2 text-base text-metro-fg-light dark:text-metro-fg-dark outline-none"
      />
      <button
        type="button"
        :disabled="props.saving"
        class="px-3.5 py-2 rounded-full bg-metro-fg-light dark:bg-metro-fg-dark
          text-metro-bg-light dark:text-metro-bg-dark text-sm disabled:opacity-50"
        @click="onSave"
      >
        {{ props.saving ? 'Saving…' : 'Save' }}
      </button>
    </div>
    <button v-else type="button" class="mt-1.5 block text-left" @click="editing = true">
      <div :class="props.value.trim() ? props.valueClass : 'text-sm text-metro-sub-light dark:text-metro-sub-dark font-sans'">
        {{ props.value.trim() || props.emptyLabel }}
      </div>
      <div v-if="props.value.trim()"
        class="text-xs text-metro-sub-light dark:text-metro-sub-dark mt-0.5 font-sans">
        Tap to edit
      </div>
    </button>
  </div>
</template>
