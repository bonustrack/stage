
import type { ReactElement, ReactNode } from 'react';
import type {
  ActionConfig,
  CaptionSize,
  Dimension,
  TextSize,
  TitleSize,
  WidgetActionRegistry,
  WidgetDataContext,
  WidgetFormValues,
  WidgetNode,
} from '../chatkit';
import type { Scheme } from '../chatkit';
import type { HeroIconName } from '@stage-labs/kit/icons';
import { HERO_ICON_PATHS } from '@stage-labs/kit/icons';

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

const ICON_NAMES = new Set(Object.keys(HERO_ICON_PATHS));

export function resolveIconName(name: string | undefined): HeroIconName | undefined {
  if (name === undefined) return undefined;
  const camel = name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
  if (ICON_NAMES.has(camel)) return camel as HeroIconName;
  if (ICON_NAMES.has(name)) return name as HeroIconName;
  return undefined;
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
};

export function titleSize(value: TitleSize | undefined): 'sm' | 'md' | 'lg' | undefined {
  return value === undefined ? undefined : TITLE_SIZE[value];
}

const CAPTION_SIZE: Record<CaptionSize, 'sm' | 'md'> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
};

export function captionSize(value: CaptionSize | undefined): 'sm' | 'md' | undefined {
  return value === undefined ? undefined : CAPTION_SIZE[value];
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
