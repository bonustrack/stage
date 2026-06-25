<script setup lang="ts">

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import type { ListViewNode, WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { settingsNavRow, SETTINGS_NAV_PRESS } from '@stage-labs/views';

const router = useRouter();
const palette = useKitPalette();

const node = computed<ListViewNode>(() => ({
  type: 'ListView',
  children: [settingsNavRow({
    label: 'Developer',
    iconStart: 'beaker',
    pressType: SETTINGS_NAV_PRESS,
    payload: { to: '/settings/developer' },
  })],
}));

const registry: WidgetActionRegistry = {
  [SETTINGS_NAV_PRESS]: (action) => {
    const to = action.payload.to;
    if (typeof to === 'string') void router.push(to);
  },
};
</script>

<template>
  <Col surface="surface" class="h-[100dvh]">
    <Row
      surface="toolbar"
      align="center"
      :gap="8"
      :padding="{ x: 12, y: 10 }"
      :style="{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: palette.border }"
    >
      <Pressable tag="button" type="button" class="p-1" @click="router.back()">
        <Icon name="arrowLeft" :size="22" :color="palette.text" />
      </Pressable>
      <Title size="sm">Experimental</Title>
    </Row>

    <Col class="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
      <Col class="w-[calc(100%-2rem)] mx-4 mt-5">
        <ChatKitRenderer :node="node" :registry="registry" />
      </Col>
    </Col>
  </Col>
</template>
