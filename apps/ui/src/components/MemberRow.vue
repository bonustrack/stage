<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { memberRow, MEMBER_PRESS, MEMBER_REMOVE } from '@stage-labs/views';
import { listRoot } from '@/lib/chatkitRow';
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

const registry: WidgetActionRegistry = {
  [MEMBER_PRESS]: () => {
    emit('open');
  },
  [MEMBER_REMOVE]: () => {
    emit('remove');
  },
};

const displayName = computed(() =>
  `${props.name ?? shortAddress(props.address)}${props.isSelf ? ' (you)' : ''}`);

const roleLabel = computed(() => {
  if (!props.role || props.role === 'member') return undefined;
  return props.role === 'owner' ? 'Owner' : 'Admin';
});

const node = computed(() =>
  listRoot(
    memberRow({
      memberId: props.address,
      avatarUri: stampAvatarUrl(props.address, 64),
      name: displayName.value,
      address: props.name ? shortAddress(props.address) : undefined,
      roleLabel: roleLabel.value,
      roleColor: 'discovery',
      removable: !props.isSelf && (props.canRemove ?? false) && !props.removing,
    }),
  ),
);
</script>

<template>
  <Box :class="{ 'opacity-50': props.removing }">
    <ChatKitRenderer :node="node" :registry="registry" />
  </Box>
</template>
