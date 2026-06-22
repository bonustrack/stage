<script setup lang="ts">

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
</script>

<template>
  <Col>
    <Col class="text-[11px] uppercase tracking-wide text-metro-sub-light dark:text-metro-sub-dark">{{ props.label }}</Col>
    <Col v-if="props.readonly" class="mt-1.5">
      <Col v-if="props.value.trim()" :class="props.valueClass">{{ props.value.trim() }}</Col>
      <Col v-else class="text-sm text-metro-sub-light dark:text-metro-sub-dark font-sans">{{ props.emptyLabel }}</Col>
    </Col>
    <Row v-else-if="editing" class="flex items-start gap-2 mt-1.5">
      <!-- kit-exception: no kit equivalent (inline-edit controls — kit Input/Textarea
           force their own inline-style box (bg/border/padding/font) that would override
           this Metro-surface themed styling, so bare elements preserve the look). -->
      <component
        :is="'textarea'"
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
      <component
        :is="'input'"
        v-else
        v-model="draft"
        type="text"
        :placeholder="props.placeholder"
        autofocus
        class="flex-1 bg-metro-surface-light dark:bg-metro-surface-dark
          border border-metro-border-light dark:border-metro-border-dark
          rounded-lg px-3 py-2 text-base text-metro-fg-light dark:text-metro-fg-dark outline-none"
      />
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
