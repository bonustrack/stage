<script setup lang="ts">

import { computed } from 'vue';
import ViewHost from '@stage-labs/kit/vue/view-host';
import { listRoot, memberRow, MEMBER_PRESS, MEMBER_REMOVE } from '@stage-labs/views';
import { useKitPalette, useKitScheme } from '@stage-labs/kit/vue/theme-context';
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

const actions = {
  [MEMBER_PRESS]: (): void => {
    emit('open');
  },
  [MEMBER_REMOVE]: (): void => {
    emit('remove');
  },
};

const palette = useKitPalette();
const scheme = useKitScheme();

const displayName = computed(() =>
  `${props.name ?? shortAddress(props.address)}${props.isSelf ? ' (you)' : ''}`);

const badgeRole = computed<'owner' | 'admin' | undefined>(() =>
  props.role === 'owner' || props.role === 'admin' ? props.role : undefined);

const node = computed(() =>
  listRoot(
    memberRow({
      memberId: props.address,
      avatarUri: stampAvatarUrl(props.address, 64),
      name: displayName.value,
      address: props.name ? shortAddress(props.address) : undefined,
      role: badgeRole.value,
      removable: !props.isSelf && (props.canRemove ?? false) && !props.removing,
      dark: scheme === 'dark',
      borderColor: palette.border,
      subColor: palette.sub,
      dangerColor: palette.danger,
      removePressedBg: scheme === 'dark' ? '#3a1820' : '#fbe3e8',
    }),
  ),
);
</script>

<template>
  <Box :class="{ 'opacity-50': props.removing }">
    <ViewHost :node="node" :actions="actions" />
  </Box>
</template>
