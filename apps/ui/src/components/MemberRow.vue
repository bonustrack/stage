<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { memberRow, MEMBER_PRESS, MEMBER_REMOVE } from '@stage-labs/views';
import { useKitPalette, useKitScheme } from '@stage-labs/kit/vue/theme-context';
import { listRoot } from '@/lib/kitRow';
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
    <KitRenderer :node="node" :registry="registry" />
  </Box>
</template>
