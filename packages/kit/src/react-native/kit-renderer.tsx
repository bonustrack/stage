
import { useMemo, useRef, type ReactNode } from 'react';
import type {
  CardNode,
  FormNode,
  TransitionNode,
  WidgetActionRegistry,
  WidgetDataContext,
  WidgetFormValues,
  WidgetNode,
  WidgetRoot,
} from '../kit';
import { resolveAlign, resolveBindings, resolveJustify, resolveWrap } from '../kit';
import { useKitScheme } from './theme-context';
import { Box } from './box';
import { Form } from './form';
import {
  isLayout,
  renderBadge,
  renderBox,
  renderCaption,
  renderCard,
  renderChart,
  renderDivider,
  renderIcon,
  renderImage,
  renderLabel,
  renderListView,
  renderMarkdown,
  renderSpacer,
  renderText,
  renderTitle,
} from './kit-render-node';
import { renderScrollRow, renderStack } from './kit-render-stack';
import {
  renderButton,
  renderCheckbox,
  renderDatePicker,
  renderInput,
  renderRadioGroup,
  renderSelect,
  renderTextarea,
} from './kit-render-controls';
import {
  renderAudioPlayer,
  renderAvatarStack,
  renderColorPicker,
  renderFilePicker,
  renderPopover,
  renderPressable,
  renderQRCode,
  renderSpinner,
  renderSwitch,
  renderTabs,
  renderTextField,
  renderVideoPlayer,
} from './kit-render-extensions';
import {
  renderList,
  submitForm,
  type FormScope,
  type RenderCtx,
} from './kit-render-shared';

type NodeOf<T extends WidgetNode['type']> = Extract<WidgetNode, { type: T }>;

function as<T extends WidgetNode['type']>(node: WidgetNode): NodeOf<T> {
  return node as NodeOf<T>;
}

type LeafRenderer = (node: WidgetNode, ctx: RenderCtx) => ReactNode;

const LEAF_RENDERERS: Partial<Record<WidgetNode['type'], LeafRenderer>> = {
  Text: (node, ctx) => renderText(as<'Text'>(node), ctx),
  Title: (node, ctx) => renderTitle(as<'Title'>(node), ctx),
  Caption: (node, ctx) => renderCaption(as<'Caption'>(node), ctx),
  Label: (node, ctx) => renderLabel(as<'Label'>(node), ctx),
  Markdown: (node, ctx) => renderMarkdown(as<'Markdown'>(node), ctx),
  Badge: (node, ctx) => renderBadge(as<'Badge'>(node), ctx),
  Icon: (node, ctx) => renderIcon(as<'Icon'>(node), ctx),
  Image: (node) => renderImage(as<'Image'>(node)),
  Divider: (node, ctx) => renderDivider(as<'Divider'>(node), ctx),
  Spacer: (node) => renderSpacer(as<'Spacer'>(node)),
  Button: (node, ctx) => renderButton(as<'Button'>(node), ctx),
  Input: (node, ctx) => renderInput(as<'Input'>(node), ctx),
  Textarea: (node, ctx) => renderTextarea(as<'Textarea'>(node), ctx),
  Select: (node, ctx) => renderSelect(as<'Select'>(node), ctx),
  Checkbox: (node, ctx) => renderCheckbox(as<'Checkbox'>(node), ctx),
  RadioGroup: (node, ctx) => renderRadioGroup(as<'RadioGroup'>(node), ctx),
  DatePicker: (node, ctx) => renderDatePicker(as<'DatePicker'>(node), ctx),
  Chart: (node, ctx) => renderChart(as<'Chart'>(node), ctx),
  Spinner: (node, ctx) => renderSpinner(as<'Spinner'>(node), ctx),
  Switch: (node, ctx) => renderSwitch(as<'Switch'>(node), ctx),
  Tabs: (node, ctx) => renderTabs(as<'Tabs'>(node), ctx),
  TextField: (node, ctx) => renderTextField(as<'TextField'>(node), ctx),
  ColorPicker: (node, ctx) => renderColorPicker(as<'ColorPicker'>(node), ctx),
  AvatarStack: (node, ctx) => renderAvatarStack(as<'AvatarStack'>(node), ctx),
  QRCode: (node, ctx) => renderQRCode(as<'QRCode'>(node), ctx),
  AudioPlayer: (node, ctx) => renderAudioPlayer(as<'AudioPlayer'>(node), ctx),
  VideoPlayer: (node) => renderVideoPlayer(as<'VideoPlayer'>(node)),
  FilePicker: (node, ctx) => renderFilePicker(as<'FilePicker'>(node), ctx),
};

function renderContainer(node: WidgetNode, ctx: RenderCtx): ReactNode | undefined {
  switch (node.type) {
    case 'Pressable':
      return renderPressable(as<'Pressable'>(node), ctx, renderNode);
    case 'Popover':
      return renderPopover(as<'Popover'>(node), ctx, renderNode);
    case 'Stack':
      return renderStack(as<'Stack'>(node), ctx, renderNode);
    case 'ScrollRow':
      return renderScrollRow(as<'ScrollRow'>(node), ctx, renderNode);
    default:
      return undefined;
  }
}

function renderNode(node: WidgetNode, ctx: RenderCtx): ReactNode {
  if (isLayout(node)) return renderBox(node, ctx, renderNode);
  const container = renderContainer(node, ctx);
  if (container !== undefined) return container;
  switch (node.type) {
    case 'Card':
      return renderCardNode(as<'Card'>(node), ctx);
    case 'ListView':
      return renderListView(as<'ListView'>(node), ctx, renderNode);
    case 'Basic':
      return <Box>{renderList(basicChildren(node), ctx, renderNode)}</Box>;
    case 'Form':
      return renderFormNode(as<'Form'>(node), ctx);
    case 'Transition':
      return renderTransition(as<'Transition'>(node), ctx);
    default: {
      const leaf = LEAF_RENDERERS[node.type];
      return leaf ? leaf(node, ctx) : renderUnknown(node, ctx);
    }
  }
}

function basicChildren(node: WidgetNode): WidgetNode[] {
  const value = (node as { children?: unknown }).children;
  if (Array.isArray(value)) return value as WidgetNode[];
  if (value && typeof value === 'object') return [value as WidgetNode];
  return [];
}

function renderUnknown(node: WidgetNode, ctx: RenderCtx): ReactNode {
  const children = basicChildren(node);
  if (children.length === 0) return null;
  return <Box>{renderList(children, ctx, renderNode)}</Box>;
}

function renderTransition(node: TransitionNode, ctx: RenderCtx): ReactNode {
  if (node.children === undefined) return null;
  return renderNode(node.children, ctx);
}

function useFormScope(): FormScope {
  const values = useRef<WidgetFormValues>({}).current;
  return useMemo<FormScope>(
    () => ({
      values,
      set: (name, value) => {
        values[name] = value;
      },
    }),
    [values],
  );
}

function renderFormNode(node: FormNode, ctx: RenderCtx): ReactNode {
  return <FormHost node={node} ctx={ctx} />;
}

function FormHost(props: { node: FormNode; ctx: RenderCtx }): ReactNode {
  const { node, ctx } = props;
  const scope = useFormScope();
  const formCtx: RenderCtx = { ...ctx, form: scope };
  return (
    <Form
      direction={node.direction === 'row' ? 'row' : 'col'}
      align={resolveAlign(node.align)}
      justify={resolveJustify(node.justify)}
      wrap={resolveWrap(node.wrap)}
      padding={node.padding}
      onSubmit={() => {
        submitForm(node.onSubmitAction, formCtx);
      }}
    >
      {renderList(node.children, formCtx, renderNode)}
    </Form>
  );
}

function renderCardNode(node: CardNode, ctx: RenderCtx): ReactNode {
  if (node.asForm === true) return <CardFormHost node={node} ctx={ctx} />;
  const children = renderList(node.children, ctx, renderNode);
  return renderCard(node, ctx, children);
}

function CardFormHost(props: { node: CardNode; ctx: RenderCtx }): ReactNode {
  const { node, ctx } = props;
  const scope = useFormScope();
  const formCtx: RenderCtx = { ...ctx, form: scope };
  const children = renderList(node.children, formCtx, renderNode);
  return renderCard(node, formCtx, children);
}

export interface KitRendererProps {
  node: WidgetRoot;
  registry?: WidgetActionRegistry;
  data?: WidgetDataContext;
}

export function KitRenderer(props: KitRendererProps): ReactNode {
  const { node, registry, data } = props;
  const scheme = useKitScheme();
  const resolved = useMemo(
    () => (data ? resolveBindings(node, data) : node),
    [node, data],
  );
  const ctx: RenderCtx = {
    registry: registry ?? {},
    data: data ?? {},
    scheme,
    dark: scheme === 'dark',
  };
  return renderNode(resolved, ctx);
}
