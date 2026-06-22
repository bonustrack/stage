<script setup lang="ts">

import { stampAvatarUrl } from '../lib/xmtp';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';


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
  if (props.avatarUri) return avatarRenderUrl('', props.avatarUri, 88);
  if (props.avatarAddress) return stampAvatarUrl(props.avatarAddress, 88);
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
  <Pressable
    tag="button"
    type="button"
    class="w-full text-left px-3.5
      hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
      active:bg-metro-border-light dark:active:bg-metro-border-dark"
    @click="emit('open')"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <Row align="center" :gap="12" class="min-h-[67px] py-[9px]">
      <AvatarView :src="renderedAvatar" :size="44" />
      <Col class="flex-1 min-w-0">
        <Row align="center" :gap="6">
          <Text
            size="3xl"
            weight="semibold"
            color="link"
            :truncate="true"
            class="flex-1 min-w-0"
          >{{ props.title }}</Text>
          <Text v-if="fmtTs(props.lastTs)" size="sm" color="secondary" class="shrink-0">
            {{ fmtTs(props.lastTs) }}
          </Text>
        </Row>
        <Row align="start" :gap="7" class="mt-0.5">
          <Text
            size="lg"
            color="secondary"
            class="flex-1 min-w-0 leading-[21px] line-clamp-2"
          >{{ props.lastPreview || '(no messages yet)' }}</Text>
          <Row v-if="props.unreadCount > 0"
            align="center" justify="center"
            class="min-w-[22px] h-[22px] rounded-full px-[7px] shrink-0
              bg-metro-link-light dark:bg-metro-link-dark">
            <Text size="2xs" weight="semibold"
              class="!text-metro-bg-light dark:!text-metro-bg-dark">
              {{ props.unreadCount > 99 ? '99+' : props.unreadCount }}
            </Text>
          </Row>
          <!-- Explicitly marked unread (cross-device) but no counted messages → dot. -->
          <Col v-else-if="props.markedUnread"
            class="w-3 h-3 rounded-full shrink-0 mt-1 bg-metro-link-light dark:bg-metro-link-dark" />
        </Row>
      </Col>
    </Row>
  </Pressable>
</template>
