<script setup lang="ts">

import { computed, toRef } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { useCommonChannels } from '../lib/useCommonChannels';

const props = defineProps<{ peerAddress: string | null; enabled: boolean }>();

const router = useRouter();
const palette = useKitPalette();

const { channels, loading } = useCommonChannels(
  toRef(props, 'peerAddress'),
  toRef(props, 'enabled'),
);

const show = computed(() => loading.value || channels.value.length > 0);

function open(convId: string): void {
  void router.push(`/xmtp/${convId}`);
}
</script>

<template>
  <!-- Mutual group memberships with this peer, mirroring mobile CommonChannels:
       a "Channels" tab header (with a spinner while resolving) over reused
       ChannelRow list items. Hidden entirely when there are no common channels. -->
  <Col v-if="show" class="mt-5">
    <Row
      align="center"
      justify="start"
      :gap="24"
      class="mx-4 mb-1.5 border-b"
      :style="{ borderColor: palette.border }"
    >
      <Col
        class="py-2.5 -mb-px border-b-2"
        :style="{ borderColor: palette.link }"
      >
        <Text size="3xl" weight="semibold" color="link">Channels</Text>
      </Col>
      <Spinner v-if="loading" :size="20" />
    </Row>

    <ChannelRow
      v-for="ch in channels"
      :key="ch.convId"
      :title="ch.title"
      :avatar-uri="ch.avatarUri"
      :avatar-address="ch.avatarUri ? null : ch.avatarAddress"
      :last-ts="ch.lastTs"
      :last-preview="ch.lastPreview"
      :subtitle="`${ch.memberCount} member${ch.memberCount === 1 ? '' : 's'}`"
      :unread-count="ch.unreadCount"
      :marked-unread="ch.markedUnread"
      @open="open(ch.convId)"
    />
  </Col>
</template>
