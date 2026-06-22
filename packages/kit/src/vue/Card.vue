<script setup lang="ts">
import { computed } from 'vue';
import Button from './Button.vue';
import { BLOCK_RADIUS_DEFAULT, FONT_SIZE, schemePalette } from '../tokens';

export type CardSize = 'sm' | 'md' | 'lg';

export interface CardStatus {
  text: string;
  favicon?: string;
}

export interface CardAction {
  label: string;
}

const props = withDefaults(
  defineProps<{
    size?: CardSize;
    padding?: number;
    background?: string;
    status?: CardStatus;
    collapsed?: boolean;
    confirm?: CardAction;
    cancel?: CardAction;
    pressable?: boolean;
    dark: boolean;
  }>(),
  { size: 'md', collapsed: false },
);

const emit = defineEmits<{ press: []; confirm: []; cancel: [] }>();

const PADDING: Record<CardSize, number> = { sm: 10, md: 14, lg: 18 };
const STATUS_SIZE: Record<CardSize, number> = {
  sm: FONT_SIZE['2xs'],
  md: FONT_SIZE.xs,
  lg: FONT_SIZE.sm,
};

const c = computed(() => schemePalette(props.dark));
const pad = computed(() => props.padding ?? PADDING[props.size]);

const style = computed<Record<string, string>>(() => ({
  backgroundColor: props.background ?? c.value.surface,
  borderColor: c.value.border,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: `${BLOCK_RADIUS_DEFAULT}px`,
  padding: `${pad.value}px`,
  cursor: props.pressable ? 'pointer' : 'default',
}));

const statusStyle = computed<Record<string, string>>(() => ({
  color: c.value.sub,
  fontSize: `${STATUS_SIZE[props.size]}px`,
  fontFamily: 'Calibre-Medium',
  marginBottom: props.collapsed ? '0' : '8px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const hasFoot = computed(() => Boolean(props.confirm) || Boolean(props.cancel));
</script>

<template>
  <component
    :is="pressable ? 'button' : 'div'"
    :style="style"
    @click="pressable ? emit('press') : undefined"
  >
    <div v-if="status" :style="statusStyle">
      <template v-if="status.favicon">{{ status.favicon }}&nbsp;&nbsp;</template>{{ status.text }}
    </div>
    <slot v-if="!collapsed" />
    <div
      v-if="hasFoot"
      :style="{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }"
    >
      <Button
        v-if="cancel"
        variant="secondary"
        size="sm"
        :label="cancel.label"
        :dark="dark"
        @click="emit('cancel')"
      />
      <Button
        v-if="confirm"
        variant="primary"
        size="sm"
        :label="confirm.label"
        :dark="dark"
        @click="emit('confirm')"
      />
    </div>
  </component>
</template>
