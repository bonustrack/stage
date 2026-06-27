
import type { ReactElement, ReactNode } from 'react';
import type {
  ActionConfig,
  Dimension,
  TextSize,
  TitleSize,
  WidgetActionRegistry,
  WidgetDataContext,
  WidgetFormValues,
  WidgetNode,
} from '../kit';
import type { Scheme } from '../kit';
import { resolveCaptionSize, resolveIconName } from '../kit';

export { resolveIconName };

export const captionSize = resolveCaptionSize;

export interface FormScope {
  values: WidgetFormValues;
  set: (name: string, value: unknown) => void;
}

export interface RenderCtx {
  registry: WidgetActionRegistry;
  data: WidgetDataContext;
  scheme: Scheme;
  dark: boolean;
  form?: FormScope;
}

export type NodeRenderer = (node: WidgetNode, ctx: RenderCtx) => ReactNode;

export function dispatch(
  action: ActionConfig | undefined,
  ctx: RenderCtx,
  values?: WidgetFormValues,
): void {
  if (action === undefined) return;
  const handler = ctx.registry[action.type];
  if (handler === undefined) return;
  const merged = mergePayload(action, values);
  void handler({ type: action.type, payload: merged });
}

function mergePayload(
  action: ActionConfig,
  values: WidgetFormValues | undefined,
): Record<string, unknown> {
  const base =
    typeof action.payload === 'object' &&
    action.payload !== null &&
    !Array.isArray(action.payload)
      ? { ...(action.payload as Record<string, unknown>) }
      : {};
  return { ...base, ...(values ?? {}) };
}

export function submitForm(action: ActionConfig | undefined, ctx: RenderCtx): void {
  if (action === undefined) return;
  dispatch(action, ctx, ctx.form?.values);
}

const TITLE_SIZE: Record<TitleSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
  '2xl': 'lg',
  '3xl': 'lg',
  '4xl': 'lg',
  '5xl': 'lg',
  '6xl': 'lg',
  '7xl': 'lg',
};

export function titleSize(value: TitleSize | undefined): 'sm' | 'md' | 'lg' | undefined {
  return value === undefined ? undefined : TITLE_SIZE[value];
}


export function textSize(value: TextSize | undefined): TextSize | undefined {
  return value;
}

export function toNumber(value: Dimension | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function nodeKey(node: WidgetNode, index: number): string {
  if (typeof node.key === 'string') return node.key;
  if (typeof node.id === 'string') return node.id;
  return `${node.type}-${index}`;
}

export function renderList(
  nodes: WidgetNode[] | undefined,
  ctx: RenderCtx,
  render: NodeRenderer,
): ReactElement[] {
  if (nodes === undefined) return [];
  return nodes.map((child, index) => (
    <Keyed key={nodeKey(child, index)}>{render(child, ctx)}</Keyed>
  ));
}

function Keyed({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>;
}
