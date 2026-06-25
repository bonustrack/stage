<script setup lang="ts">
import { computed } from 'vue';
import KitNode from './KitNode.vue';
import Spinner from './Spinner.vue';
import Switch from './Switch.vue';
import Tabs from './Tabs.vue';
import AvatarStack from './AvatarStack.vue';
import QRCode from './QRCode.vue';
import AudioPlayer from './AudioPlayer.vue';
import VideoPlayer from './VideoPlayer.vue';
import TextField from './TextField.vue';
import ColorPicker from './ColorPicker.vue';
import Stack from './Stack.vue';
import ScrollRow from './ScrollRow.vue';
import GesturePressable from './GesturePressable.vue';
import {
  dispatchAction,
  resolveOptionalColor,
  resolveRadius,
  resolveSpinnerSize,
  resolveWeight,
  type ActionConfig,
  type AudioPlayerNode,
  type AvatarStackNode,
  type ColorPickerNode,
  type PressableNode,
  type QRCodeNode,
  type ScrollRowNode,
  type SpinnerNode,
  type StackNode,
  type SwipeDirection,
  type SwitchNode,
  type TabsNode,
  type TextFieldNode,
  type VideoPlayerNode,
  type WidgetNode,
} from '../kit';
import { useKitForm, useKitRender } from './kit-form-context';

const props = defineProps<{ node: WidgetNode }>();

const render = useKitRender();
const form = useKitForm();
const scheme = computed(() => render.scheme);

function emitChange(name: string, value: unknown, action?: ActionConfig): void {
  if (form) form.setValue(name, value);
  if (action) void dispatchAction(render.registry, action, { [name]: value });
}

function fire(action: ActionConfig | undefined, payload?: Record<string, unknown>): void {
  if (action === undefined) return;
  void dispatchAction(render.registry, action, payload);
}

const spinner = computed(() => props.node as SpinnerNode);
const switchNode = computed(() => props.node as SwitchNode);
const tabsNode = computed(() => props.node as TabsNode);
const textFieldNode = computed(() => props.node as TextFieldNode);
const colorNode = computed(() => props.node as ColorPickerNode);
const avatarNode = computed(() => props.node as AvatarStackNode);
const qrNode = computed(() => props.node as QRCodeNode);
const audioNode = computed(() => props.node as AudioPlayerNode);
const videoNode = computed(() => props.node as VideoPlayerNode);
const pressableNode = computed(() => props.node as PressableNode);
const stackNode = computed(() => props.node as StackNode);
const scrollRowNode = computed(() => props.node as ScrollRowNode);

const pressableChildren = computed<WidgetNode[]>(() =>
  props.node.type === 'Pressable' ? pressableNode.value.children : [],
);

function onSwipe(direction: SwipeDirection): void {
  fire(pressableNode.value.onSwipeAction, { direction });
}
</script>

<template>
  <Spinner
    v-if="node.type === 'Spinner'"
    :size="resolveSpinnerSize(spinner.size)"
    :color="resolveOptionalColor(spinner.color, scheme)"
  />

  <Switch
    v-else-if="node.type === 'Switch'"
    :name="switchNode.name"
    :checked="switchNode.checked"
    :label="switchNode.label"
    :disabled="switchNode.disabled"
    @update:checked="emitChange(switchNode.name, $event, switchNode.onChangeAction)"
  />

  <Tabs
    v-else-if="node.type === 'Tabs'"
    :value="tabsNode.value"
    :options="tabsNode.options"
    :variant="tabsNode.variant === 'underline' ? 'underline' : 'segmented'"
    @update:value="emitChange(tabsNode.name, $event, tabsNode.onChangeAction)"
  />

  <TextField
    v-else-if="node.type === 'TextField'"
    :name="textFieldNode.name"
    :value="textFieldNode.value"
    :placeholder="textFieldNode.placeholder"
    :multiline="textFieldNode.multiline"
    :auto-focus="textFieldNode.autoFocus"
    :auto-grow="textFieldNode.autoGrow"
    :disabled="textFieldNode.disabled"
    :selection="textFieldNode.selection"
    :focus-nonce="textFieldNode.focusNonce"
    :variant="textFieldNode.variant"
    :background="resolveOptionalColor(textFieldNode.background, scheme)"
    :border-color="resolveOptionalColor(textFieldNode.borderColor, scheme)"
    :radius="resolveRadius(textFieldNode.radius)"
    :padding-x="textFieldNode.paddingX"
    :padding-y="textFieldNode.paddingY"
    :font-size="textFieldNode.fontSize"
    :font-family="resolveWeight(textFieldNode.fontWeight)"
    :color="resolveOptionalColor(textFieldNode.color, scheme)"
    :placeholder-color="resolveOptionalColor(textFieldNode.placeholderColor, scheme)"
    :max-length="textFieldNode.maxLength"
    :max-height="textFieldNode.maxHeight"
    :enter-key-hint="textFieldNode.returnKeyType"
    :auto-capitalize="textFieldNode.autoCapitalize"
    :auto-correct="textFieldNode.autoCorrect"
    @update:value="emitChange(textFieldNode.name, $event, textFieldNode.onChangeAction)"
    @selection-change="fire(textFieldNode.onSelectionChangeAction, $event)"
    @submit="fire(textFieldNode.onSubmitAction, { [textFieldNode.name]: textFieldNode.value })"
  />

  <ColorPicker
    v-else-if="node.type === 'ColorPicker'"
    :value="colorNode.value"
    :swatches="colorNode.swatches"
    @update:value="emitChange(colorNode.name, $event, colorNode.onChangeAction)"
  />

  <AvatarStack
    v-else-if="node.type === 'AvatarStack'"
    :items="avatarNode.items"
    :size="avatarNode.size"
    :max="avatarNode.max"
    :overlap="avatarNode.overlap"
  />

  <QRCode
    v-else-if="node.type === 'QRCode'"
    :value="qrNode.value"
    :size="qrNode.size"
    :color="resolveOptionalColor(qrNode.color, scheme)"
    :background="resolveOptionalColor(qrNode.background, scheme)"
  />

  <AudioPlayer
    v-else-if="node.type === 'AudioPlayer'"
    :src="audioNode.src"
    :duration="audioNode.duration"
    @play="fire(audioNode.onPlayAction)"
  />

  <VideoPlayer
    v-else-if="node.type === 'VideoPlayer'"
    :src="videoNode.src"
    :poster="videoNode.poster"
    :controls="videoNode.controls"
  />

  <Stack v-else-if="node.type === 'Stack'" :node="stackNode" />

  <ScrollRow v-else-if="node.type === 'ScrollRow'" :node="scrollRowNode" />

  <GesturePressable
    v-else-if="node.type === 'Pressable'"
    :clickable="pressableNode.onClickAction !== undefined"
    :long-pressable="pressableNode.onLongPressAction !== undefined"
    :swipeable="pressableNode.onSwipeAction !== undefined"
    @press="fire(pressableNode.onClickAction)"
    @longpress="fire(pressableNode.onLongPressAction)"
    @swipe="onSwipe"
  >
    <KitNode v-for="(c, i) in pressableChildren" :key="i" :node="c" />
  </GesturePressable>
</template>
