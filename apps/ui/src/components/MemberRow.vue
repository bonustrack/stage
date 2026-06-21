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
  <Row
    tag="li"
    align="center"
    :gap="12"
    class="px-3.5 py-2.5
      bg-metro-surface-light dark:bg-metro-surface-dark
      border-b border-metro-border-light dark:border-metro-border-dark"
    :class="{ 'opacity-50': props.removing }"
  >
    <Pressable tag="button" type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left" @click="emit('open')">
      <img :src="stampAvatarUrl(props.address, 64)" alt="" class="w-8 h-8 rounded-full bg-metro-border-dark" />
      <Col class="flex-1 min-w-0">
        <Col class="text-sm text-metro-head-light dark:text-metro-head-dark truncate font-head">
          {{ props.name || shortAddress(props.address) }}{{ props.isSelf ? ' (you)' : '' }}
        </Col>
        <Col v-if="props.name" class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate mt-0.5">
          {{ shortAddress(props.address) }}
        </Col>
      </Col>
    </Pressable>
    <span
      v-if="props.role && props.role !== 'member'"
      class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-sans"
      :class="props.role === 'owner'
        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
        : 'bg-metro-border-light dark:bg-metro-border-dark text-metro-sub-light dark:text-metro-sub-dark'"
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
