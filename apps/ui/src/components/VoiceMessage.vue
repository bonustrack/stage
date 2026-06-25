<script setup lang="ts">

import { computed } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { voiceMessage, VOICE_PLAY } from '@stage-labs/views';
import { basicRoot } from '@/lib/kitRow';

const props = defineProps<{ src: string }>();

const node = computed(() => basicRoot(voiceMessage({ src: props.src })));

const registry: WidgetActionRegistry = {
  [VOICE_PLAY]: () => undefined,
};
</script>

<template>
  <KitRenderer :node="node" :registry="registry" />
</template>
