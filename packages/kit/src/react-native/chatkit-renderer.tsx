
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
} from '../chatkit';
import { resolveAlign, resolveBindings, resolveJustify, resolveWrap } from '../chatkit';
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
} from './chatkit-render-node';
import {
  renderButton,
  renderCheckbox,
  renderDatePicker,
  renderInput,
  renderRadioGroup,
  renderSelect,
  renderTextarea,
} from './chatkit-render-controls';
import {
  renderList,
  submitForm,
  type FormScope,
  type RenderCtx,
} from './chatkit-render-shared';

type NodeOf<T extends WidgetNode['type']> = Extract<WidgetNode, { type: T }>;

function as<T extends WidgetNode['type']>(node: WidgetNode): NodeOf<T> {
  return node as NodeOf<T>;
}

function renderNode(node: WidgetNode, ctx: RenderCtx): ReactNode {
  if (isLayout(node)) return renderBox(node, ctx, renderNode);
  switch (node.type) {
    case 'Card':
      return renderCardNode(as<'Card'>(node), ctx);
    case 'ListView':
      return renderListView(as<'ListView'>(node), ctx, renderNode);
    case 'Basic':
      return <Box>{renderList(basicChildren(node), ctx, renderNode)}</Box>;
    case 'Form':
      return renderFormNode(as<'Form'>(node), ctx);
    case 'Text':
      return renderText(as<'Text'>(node), ctx);
    case 'Title':
      return renderTitle(as<'Title'>(node), ctx);
    case 'Caption':
      return renderCaption(as<'Caption'>(node), ctx);
    case 'Label':
      return renderLabel(as<'Label'>(node), ctx);
    case 'Markdown':
      return renderMarkdown(as<'Markdown'>(node), ctx);
    case 'Badge':
      return renderBadge(as<'Badge'>(node));
    case 'Icon':
      return renderIcon(as<'Icon'>(node), ctx);
    case 'Image':
      return renderImage(as<'Image'>(node));
    case 'Divider':
      return renderDivider(as<'Divider'>(node), ctx);
    case 'Spacer':
      return renderSpacer(as<'Spacer'>(node));
    case 'Button':
      return renderButton(as<'Button'>(node), ctx);
    case 'Input':
      return renderInput(as<'Input'>(node), ctx);
    case 'Textarea':
      return renderTextarea(as<'Textarea'>(node), ctx);
    case 'Select':
      return renderSelect(as<'Select'>(node), ctx);
    case 'Checkbox':
      return renderCheckbox(as<'Checkbox'>(node), ctx);
    case 'RadioGroup':
      return renderRadioGroup(as<'RadioGroup'>(node), ctx);
    case 'DatePicker':
      return renderDatePicker(as<'DatePicker'>(node), ctx);
    case 'Chart':
      return renderChart(as<'Chart'>(node), ctx);
    case 'Transition':
      return renderTransition(as<'Transition'>(node), ctx);
    default:
      return renderUnknown(node, ctx);
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
      onSubmit={() => submitForm(node.onSubmitAction, formCtx)}
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

export interface ChatKitRendererProps {
  node: WidgetRoot;
  registry?: WidgetActionRegistry;
  data?: WidgetDataContext;
}

export function ChatKitRenderer(props: ChatKitRendererProps): ReactNode {
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
