<script setup lang="ts">

import { computed, ref } from 'vue';
import KitRenderer from '@stage-labs/kit/vue/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';

const props = defineProps<{
  imageUrl: string;
  uploading: boolean;
  readonly?: boolean;
  square?: boolean;
}>();
const emit = defineEmits<(e: 'pick', file: File) => void>();

const palette = useKitPalette();

const SIZE = 88;
const SQUARE_RADIUS = Math.round(SIZE * 0.12);

const openNonce = ref(0);
function pick(): void { openNonce.value += 1; }

const pickerNode = computed<WidgetRoot>(() => ({
  type: 'Basic',
  children: [
    {
      type: 'FilePicker',
      openNonce: openNonce.value,
      accept: 'image/jpeg,image/png',
      onPickAction: { type: 'avatar_pick', handler: 'client' },
    },
  ],
}));

const pickerRegistry: WidgetActionRegistry = {
  avatar_pick: (a) => {
    const files = a.payload.files;
    const file = Array.isArray(files) ? (files[0] as File | undefined) : undefined;
    if (file) emit('pick', file);
  },
};
</script>

<template>
  <Col align="center" :gap="8" class="pt-1 pb-1">
    <Pressable tag="button" type="button" :disabled="props.uploading || props.readonly" class="relative" @click="pick">
      <Image
        v-if="props.imageUrl"
        :src="avatarRenderUrl('', props.imageUrl, 240)"
        :size="props.square ? SIZE : 96"
        :radius="props.square ? SQUARE_RADIUS : 999"
        :background="palette.inputBg"
        :style="{ opacity: props.uploading ? '0.5' : '1' }"
      />
      <Box
        v-else
        surface="raised"
        align="center"
        justify="center"
        :width="props.square ? SIZE : 96"
        :height="props.square ? SIZE : 96"
        :radius="props.square ? SQUARE_RADIUS : 999"
        :style="{ borderWidth: '1px', borderStyle: 'solid', borderColor: palette.border, opacity: props.uploading ? '0.5' : '1' }"
      >
        <Text v-if="props.square && !props.readonly" size="6xl" role="secondary">＋</Text>
        <Icon v-else :name="props.readonly ? 'users' : 'plus'" :size="28" :color="palette.sub" />
      </Box>
    </Pressable>
    <KitRenderer :node="pickerNode" :registry="pickerRegistry" />
    <Text v-if="!props.readonly" size="xs" role="secondary">
      {{ props.uploading ? 'Uploading…' : (props.imageUrl ? 'Tap to change image' : 'Tap to add a group image') }}
    </Text>
  </Col>
</template>
