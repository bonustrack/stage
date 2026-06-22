<script setup lang="ts">

import { shortAddress, stampAvatarUrl } from '../lib/xmtp';


const props = defineProps<{
  address: string;
  name: string | null;
  isSelf: boolean;
  removing: boolean;
  role?: 'owner' | 'admin' | 'member';
  canRemove?: boolean;
}>();
const emit = defineEmits<{ open: []; remove: [] }>();
</script>

<template>
  <!-- Member rows are transparent; only the press state tints the background with
       the border color (no persistent grey card), mirroring mobile. -->
  <Row
    tag="li"
    align="center"
    :gap="12"
    class="px-3.5 py-2.5
      active:bg-metro-border-light dark:active:bg-metro-border-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
    :class="{ 'opacity-50': props.removing }"
  >
    <Pressable tag="button" type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" @click="emit('open')">
      <img :src="stampAvatarUrl(props.address, 64)" alt="" class="w-8 h-8 rounded-full bg-metro-border-light dark:bg-metro-border-dark" />
      <Col class="flex-1 min-w-0">
        <Col class="text-[15px] font-semibold text-metro-head-light dark:text-metro-head-dark truncate font-head">
          {{ props.name || shortAddress(props.address) }}{{ props.isSelf ? ' (you)' : '' }}
        </Col>
        <Col v-if="props.name" class="text-[13px] text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
          {{ shortAddress(props.address) }}
        </Col>
      </Col>
    </Pressable>
    <!-- Owner/admin role badge: rgba(45,212,191,.18) bg, #2dd4bf color, 11px,
         padding x8/y2, radius 999 — mirroring mobile member role pill. -->
    <span
      v-if="props.role && props.role !== 'member'"
      class="shrink-0 text-[11px] font-sans"
      :style="{
        backgroundColor: 'rgba(45,212,191,0.18)',
        color: '#2dd4bf',
        paddingLeft: '8px', paddingRight: '8px',
        paddingTop: '2px', paddingBottom: '2px',
        borderRadius: '999px',
      }"
    >{{ props.role === 'owner' ? 'Owner' : 'Admin' }}</span>
    <Pressable
      tag="button"
      v-if="!props.isSelf && props.canRemove"
      type="button"
      :disabled="props.removing"
      class="p-1.5 rounded-full text-red-500 hover:bg-red-500/10 disabled:opacity-50"
      @click="emit('remove')"
    >
      <Icon name="trash" :size="18" />
    </Pressable>
  </Row>
</template>
