<script setup lang="ts">
import { computed } from 'vue';
import Box from './Box.vue';
import Row from './Row.vue';
import Col from './Col.vue';
import Form from './Form.vue';
import Text from './Text.vue';
import Title from './Title.vue';
import Caption from './Caption.vue';
import Label from './Label.vue';
import Markdown from './Markdown.vue';
import Button from './Button.vue';
import Icon from './Icon.vue';
import Image from './Image.vue';
import Divider from './Divider.vue';
import Spacer from './Spacer.vue';
import Input from './Input.vue';
import Textarea from './Textarea.vue';
import Select from './Select.vue';
import Checkbox from './Checkbox.vue';
import RadioGroup from './RadioGroup.vue';
import DatePicker from './DatePicker.vue';
import ListViewItem from './ListViewItem.vue';
import KitChart from './KitChart.vue';
import KitExtensionNode from './KitExtensionNode.vue';
import GesturePressable from './GesturePressable.vue';
import {
  dispatchAction,
  type ActionConfig,
  type BadgeNode,
  type ButtonNode,
  type CaptionNode,
  type CheckboxNode,
  type DatePickerNode,
  type DividerNode,
  type FormNode,
  type IconNode,
  type ImageNode,
  type InputNode,
  type LabelNode,
  type ListViewItemNode,
  type MarkdownNode,
  type RadioGroupNode,
  type SelectNode,
  type SpacerNode,
  type TextareaNode,
  type TextNode,
  type TitleNode,
  type TransitionNode,
  type WidgetNode,
  type ChartNode,
} from '../kit';
import {
  badgeProps,
  boxProps,
  buttonProps,
  captionSize,
  captionWeight,
  dividerColor,
  fieldVariant,
  heroTitlePx,
  imageProps,
  isExtensionType,
  listItemProps,
  resolveIconName,
  titleSize,
} from './kit-node-props';
import { useKitForm, useKitRender } from './kit-form-context';

const props = defineProps<{ node: WidgetNode }>();

const render = useKitRender();
const form = useKitForm();

const scheme = computed(() => render.scheme);

function fire(action: ActionConfig | undefined): void {
  if (action === undefined) return;
  if (action.type === 'submit' && form) {
    void dispatchAction(render.registry, action, form.getValues());
    return;
  }
  void dispatchAction(render.registry, action);
}

function onSubmitForm(action: ActionConfig | undefined): void {
  if (action === undefined) return;
  void dispatchAction(render.registry, action, form ? form.getValues() : {});
}

function changeText(name: string, value: string, action?: ActionConfig): void {
  if (form) form.setValue(name, value);
  if (action) void dispatchAction(render.registry, action, { [name]: value });
}

function changeBool(name: string, value: boolean, action?: ActionConfig): void {
  if (form) form.setValue(name, value);
  if (action) void dispatchAction(render.registry, action, { [name]: value });
}

const children = computed<WidgetNode[]>(() => {
  const maybe = (props.node as { children?: unknown }).children;
  return Array.isArray(maybe) ? (maybe as WidgetNode[]) : [];
});

const boxNode = computed(
  () => props.node as FormNode & { direction?: 'row' | 'col' },
);
const titleNode = computed(() => props.node as TitleNode);
const textNode = computed(() => props.node as TextNode);
const captionNode = computed(() => props.node as CaptionNode);
const labelNode = computed(() => props.node as LabelNode);
const markdownNode = computed(() => props.node as MarkdownNode);
const badgeNode = computed(() => props.node as BadgeNode);
const badge = computed(() => badgeProps(badgeNode.value, scheme.value));
const buttonNode = computed(() => props.node as ButtonNode);
const iconNode = computed(() => props.node as IconNode);
const imageNode = computed(() => props.node as ImageNode);
const dividerNode = computed(() => props.node as DividerNode);
const spacerNode = computed(() => props.node as SpacerNode);
const formNode = computed(() => props.node as FormNode);
const inputNode = computed(() => props.node as InputNode);
const textareaNode = computed(() => props.node as TextareaNode);
const selectNode = computed(() => props.node as SelectNode);
const checkboxNode = computed(() => props.node as CheckboxNode);
const radioNode = computed(() => props.node as RadioGroupNode);
const dateNode = computed(() => props.node as DatePickerNode);
const listItemNode = computed(() => props.node as ListViewItemNode);
const chartNode = computed(() => props.node as ChartNode);

const transitionChild = computed<WidgetNode | undefined>(() => {
  const node = props.node;
  if (node.type !== 'Transition') return undefined;
  return (node as TransitionNode).children;
});

const isExtension = computed(() => isExtensionType(props.node.type));

const itemHasGesture = computed(
  () =>
    listItemNode.value.onLongPressAction !== undefined ||
    listItemNode.value.onSwipeAction !== undefined,
);

function fireWith(action: ActionConfig | undefined, payload: Record<string, unknown>): void {
  if (action === undefined) return;
  void dispatchAction(render.registry, action, payload);
}
</script>

<template>
  <Row
    v-if="node.type === 'Row'"
    v-bind="boxProps(boxNode, scheme)"
  >
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </Row>

  <Col
    v-else-if="node.type === 'Col'"
    v-bind="boxProps(boxNode, scheme)"
  >
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </Col>

  <Box
    v-else-if="node.type === 'Box'"
    v-bind="boxProps(boxNode, scheme)"
  >
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </Box>

  <Form
    v-else-if="node.type === 'Form'"
    v-bind="boxProps(boxNode, scheme)"
    @submit="onSubmitForm(formNode.onSubmitAction)"
  >
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </Form>

  <Title
    v-else-if="node.type === 'Title'"
    :size="titleSize(titleNode.size)"
    :font-size-px="heroTitlePx(titleNode.size)"
    :color="titleNode.color === undefined ? undefined : String(titleNode.color)"
  >
    {{ titleNode.value }}
  </Title>

  <Text
    v-else-if="node.type === 'Text'"
    :value="textNode.value"
    :size="textNode.size"
    :weight="textNode.weight"
    :italic="textNode.italic"
    :line-through="textNode.lineThrough"
    :text-align="textNode.textAlign"
    :truncate="textNode.truncate"
    :color="textNode.color === undefined ? undefined : String(textNode.color)"
  />

  <Caption
    v-else-if="node.type === 'Caption'"
    :value="captionNode.value"
    :size="captionSize(captionNode.size)"
    :weight="captionWeight(captionNode.weight)"
    :text-align="captionNode.textAlign"
    :truncate="captionNode.truncate"
    :max-lines="captionNode.maxLines"
    :color="captionNode.color === undefined ? undefined : String(captionNode.color)"
  />

  <Label
    v-else-if="node.type === 'Label'"
    :value="labelNode.value"
    :field-name="labelNode.fieldName"
    :size="labelNode.size"
    :weight="labelNode.weight"
    :text-align="labelNode.textAlign"
    :color="labelNode.color === undefined ? undefined : String(labelNode.color)"
  />

  <Markdown
    v-else-if="node.type === 'Markdown'"
    :value="markdownNode.value"
    :streaming="markdownNode.streaming"
  />

  <Box v-else-if="node.type === 'Badge'" v-bind="badge.box">
    <Text v-bind="badge.text" />
  </Box>

  <Button
    v-else-if="node.type === 'Button'"
    v-bind="buttonProps(buttonNode, scheme)"
    @click="fire(buttonNode.submit && !buttonNode.onClickAction ? undefined : buttonNode.onClickAction)"
  >
    <template v-if="buttonNode.iconStart" #iconStart>
      <Icon :name="resolveIconName(buttonNode.iconStart)" :size="buttonNode.iconPx ?? 16" />
    </template>
    <template v-if="buttonNode.iconEnd" #iconEnd>
      <Icon :name="resolveIconName(buttonNode.iconEnd)" :size="buttonNode.iconPx ?? 16" />
    </template>
  </Button>

  <Icon
    v-else-if="node.type === 'Icon'"
    :name="resolveIconName(iconNode.name)"
    :color="iconNode.color === undefined ? undefined : String(iconNode.color)"
  />

  <Image
    v-else-if="node.type === 'Image'"
    v-bind="imageProps(imageNode, scheme)"
  />

  <Divider
    v-else-if="node.type === 'Divider'"
    :spacing="typeof dividerNode.spacing === 'number' ? dividerNode.spacing : undefined"
    :size="typeof dividerNode.size === 'number' ? dividerNode.size : undefined"
    :flush="dividerNode.flush"
    :color="dividerColor(dividerNode.color, scheme)"
  />

  <Spacer
    v-else-if="node.type === 'Spacer'"
    :min-size="spacerNode.minSize"
  />

  <Input
    v-else-if="node.type === 'Input'"
    :name="inputNode.name"
    :model-value="inputNode.defaultValue"
    :placeholder="inputNode.placeholder"
    :variant="inputNode.variant"
    :size="inputNode.size"
    :pill="inputNode.pill"
    :disabled="inputNode.disabled"
    :input-type="inputNode.inputType"
    :auto-focus="inputNode.autoFocus"
    @update:model-value="changeText(inputNode.name, $event)"
  />

  <Textarea
    v-else-if="node.type === 'Textarea'"
    :name="textareaNode.name"
    :model-value="textareaNode.defaultValue"
    :placeholder="textareaNode.placeholder"
    :variant="textareaNode.variant"
    :size="textareaNode.size"
    :rows="textareaNode.rows"
    :max-rows="textareaNode.maxRows"
    :auto-resize="textareaNode.autoResize"
    :auto-focus="textareaNode.autoFocus"
    :required="textareaNode.required"
    :disabled="textareaNode.disabled"
    @update:model-value="changeText(textareaNode.name, $event)"
  />

  <Select
    v-else-if="node.type === 'Select'"
    :name="selectNode.name"
    :options="selectNode.options"
    :model-value="selectNode.defaultValue"
    :placeholder="selectNode.placeholder"
    :variant="fieldVariant(selectNode.variant)"
    :size="selectNode.size"
    :pill="selectNode.pill"
    :block="selectNode.block"
    :clearable="selectNode.clearable"
    :disabled="selectNode.disabled"
    @update:model-value="changeText(selectNode.name, $event, selectNode.onChangeAction)"
  />

  <Checkbox
    v-else-if="node.type === 'Checkbox'"
    :name="checkboxNode.name"
    :label="checkboxNode.label"
    :model-value="checkboxNode.defaultChecked"
    :disabled="checkboxNode.disabled"
    :required="checkboxNode.required"
    @update:model-value="changeBool(checkboxNode.name, $event, checkboxNode.onChangeAction)"
  />

  <RadioGroup
    v-else-if="node.type === 'RadioGroup'"
    :name="radioNode.name"
    :options="radioNode.options"
    :model-value="radioNode.defaultValue"
    :direction="radioNode.direction"
    :disabled="radioNode.disabled"
    :required="radioNode.required"
    :aria-label="radioNode.ariaLabel"
    @update:model-value="changeText(radioNode.name, $event, radioNode.onChangeAction)"
  />

  <DatePicker
    v-else-if="node.type === 'DatePicker'"
    :name="dateNode.name"
    :model-value="dateNode.defaultValue"
    :placeholder="dateNode.placeholder"
    :variant="fieldVariant(dateNode.variant)"
    :size="dateNode.size"
    :pill="dateNode.pill"
    :block="dateNode.block"
    :clearable="dateNode.clearable"
    :disabled="dateNode.disabled"
    :min="dateNode.min"
    :max="dateNode.max"
    @update:model-value="changeText(dateNode.name, $event, dateNode.onChangeAction)"
  />

  <GesturePressable
    v-else-if="node.type === 'ListViewItem' && itemHasGesture"
    :long-pressable="listItemNode.onLongPressAction !== undefined"
    :swipeable="listItemNode.onSwipeAction !== undefined"
    @longpress="fire(listItemNode.onLongPressAction)"
    @swipe="fireWith(listItemNode.onSwipeAction, { direction: $event })"
  >
    <ListViewItem
      v-bind="listItemProps(listItemNode, scheme)"
      @press="fire(listItemNode.onClickAction)"
    >
      <KitNode v-for="(c, i) in children" :key="i" :node="c" />
    </ListViewItem>
  </GesturePressable>

  <ListViewItem
    v-else-if="node.type === 'ListViewItem'"
    v-bind="listItemProps(listItemNode, scheme)"
    @press="fire(listItemNode.onClickAction)"
  >
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </ListViewItem>

  <KitNode
    v-else-if="node.type === 'Transition' && transitionChild"
    :node="transitionChild"
  />

  <KitChart
    v-else-if="node.type === 'Chart'"
    :node="chartNode"
    :scheme="scheme"
  />

  <KitExtensionNode v-else-if="isExtension" :node="node" />

  <template v-else-if="children.length">
    <KitNode v-for="(c, i) in children" :key="i" :node="c" />
  </template>
</template>
