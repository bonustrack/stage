<script setup lang="ts">
/** Single row in the Channels list — avatar, title, last-message preview,
 *  unread badge. Extracted from Channels.vue to keep that file under the
 *  per-file LOC cap. */

import { stampBoxAvatarUrl } from '../lib/xmtp';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';
import { Row, Col } from './layout';

const props = defineProps<{
  avatarAddress: string | null;
  avatarUri?: string | null;
  title: string;
  lastTs: number | null;
  lastPreview: string;
  unreadCount: number;
  markedUnread?: boolean;
}>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'menu', ev: MouseEvent): void }>();

const renderedAvatar = computed(() => {
  if (props.avatarUri) return avatarRenderUrl('', props.avatarUri, 64);
  if (props.avatarAddress) return stampBoxAvatarUrl(props.avatarAddress, 64);
  return null;
});

function fmtTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
</script>

<template>
  <button
    type="button"
    class="w-full text-left px-4"
    @click="emit('open')"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <!-- Inner row carries the separator: it starts at the avatar's left edge
         (inset from the screen by the card's px-3.5), not full width. -->
    <Row align="center" :gap="12" class="py-3
      border-b border-metro-border-light dark:border-metro-border-dark">
      <img v-if="renderedAvatar"
        :src="renderedAvatar"
        alt=""
        class="w-8 h-8 rounded-full bg-metro-border-dark shrink-0 object-cover"
      />
      <div v-else class="w-8 h-8 rounded-full bg-metro-border-dark shrink-0" />
      <Col class="flex-1 min-w-0">
      <Row align="baseline" :gap="8">
        <div class="text-base text-metro-head-light dark:text-metro-head-dark truncate flex-1 font-head">
          {{ props.title }}
        </div>
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark shrink-0">
          {{ fmtTs(props.lastTs) }}
        </div>
      </Row>
      <Row align="center" :gap="8" class="mt-1">
        <div class="text-[15px] text-metro-sub-light dark:text-metro-sub-dark truncate flex-1">
          {{ props.lastPreview || '(no messages yet)' }}
        </div>
        <div v-if="props.unreadCount > 0"
          class="min-w-[22px] h-5 rounded-full px-1.5
            bg-metro-head-light dark:bg-metro-head-dark
            text-metro-bg-light dark:text-metro-bg-dark
            text-[11px] font-head flex items-center justify-center shrink-0">
          {{ props.unreadCount > 99 ? '99+' : props.unreadCount }}
        </div>
        <!-- Explicitly marked unread (cross-device) but no counted messages → dot. -->
        <div v-else-if="props.markedUnread"
          class="w-3 h-3 rounded-full shrink-0 bg-metro-head-light dark:bg-metro-head-dark" />
      </Row>
      </Col>
    </Row>
  </button>
</template>
