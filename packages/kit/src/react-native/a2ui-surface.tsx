import { useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { A2uiClient } from '../a2ui/client';
import { ROOT_SCOPE, isCheckRuleList, toBoolean, type Scope } from '../a2ui/evaluate';
import { getAt, resolveScopedPath } from '../a2ui/pointer';
import {
  ROOT_ID, isChildTemplate, isDataBinding, isEventAction, isFunctionAction, isJsonObject,
  type ComponentInstance, type JsonValue,
} from '../a2ui/protocol';
import type { ComponentInfo } from '../a2ui/catalog';
import { childRefKinds, fitsRenderLimits } from '../a2ui/structure';
import type { A2uiAccessibility } from './a2ui-props';
import {
  SurfaceContext, asEnum, asNumber, asOptionalString, asString, hasMarkdown,
  type A2uiRenderer, type A2uiRenderers, type Binding, type RenderContext, type SurfaceContextValue,
} from './a2ui-context';
import { KIT_RENDERERS } from './a2ui-renderers';
import { SortableScope } from './sortable';
import { useContentColor } from './content-color';
import { useKitPalette, useKitScheme } from './theme-context';

const RESERVED = new Set(['id', 'component', 'catalogId', 'metadata', 'action', 'checks', 'accessibility', 'weight']);
const LIVE = ['off', 'polite', 'assertive'] as const;

export interface A2uiSurfaceProps {
  client: A2uiClient;
  surfaceId: string;
  renderers?: A2uiRenderers;
  disabled?: boolean;
  mediaUrl?: (url: string) => string;
  fallback?: ReactNode;
  onActionError?: (message: string) => void;
}

function useSurfaceVersion(client: A2uiClient, surfaceId: string): number {
  const version = (): number => client.surface(surfaceId)?.version ?? -1;
  return useSyncExternalStore((listener) => client.subscribe(surfaceId, listener), version, version);
}

export function A2uiSurface({ client, surfaceId, renderers, disabled, mediaUrl, fallback = null, onActionError }: A2uiSurfaceProps): React.ReactElement | null {
  const version = useSurfaceVersion(client, surfaceId);
  const surface = client.surface(surfaceId);
  const renderable = useMemo(() => surface !== undefined && fitsRenderLimits(surface, client.registry), [surface, client, version]);
  if (surface?.components.has(ROOT_ID) !== true) return null;
  if (!renderable) return <>{fallback}</>;
  const value: SurfaceContextValue = { client, surfaceId, renderers: { ...KIT_RENDERERS, ...renderers }, disabled, mediaUrl, onActionError };
  const root = <A2uiNode key={version < 0 ? 'none' : 'root'} id={ROOT_ID} scope={ROOT_SCOPE} />;
  return (
    <SurfaceContext.Provider value={value}>
      {hasSortableList(surface.components.values()) ? <SortableScope style={SORT_SCOPE}>{root}</SortableScope> : root}
    </SurfaceContext.Provider>
  );
}

const SORT_SCOPE = { flexGrow: 1 };

function hasSortableList(components: Iterable<ComponentInstance>): boolean {
  for (const component of components) if (component.component === 'List' && component.sortable !== undefined && component.sortable !== false) return true;
  return false;
}

function resolveAccessibility(ctx: SurfaceContextValue, raw: JsonValue | undefined, scope: Scope): A2uiAccessibility | undefined {
  if (!isJsonObject(raw)) return undefined;
  const resolve = (v: JsonValue | undefined): unknown => ctx.client.resolve(ctx.surfaceId, v, scope);
  return {
    label: asOptionalString(resolve(raw.label)),
    description: asOptionalString(resolve(raw.description)),
    live: asEnum(raw.live, LIVE),
    hidden: raw.hidden !== undefined && toBoolean(resolve(raw.hidden)),
  };
}

function componentInfoOf(ctx: SurfaceContextValue, instance: ComponentInstance): ComponentInfo | undefined {
  const catalogId = instance.catalogId ?? ctx.client.surface(ctx.surfaceId)?.catalogId;
  return catalogId === undefined ? undefined : ctx.client.registry.component(catalogId, instance.component);
}

function catalogDefaults(info: ComponentInfo | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [prop, meta] of Object.entries(info?.properties ?? {})) if (meta.default !== undefined) out[prop] = meta.default;
  return out;
}

function resolveProps(ctx: SurfaceContextValue, instance: ComponentInstance, scope: Scope): Record<string, unknown> {
  const info = componentInfoOf(ctx, instance);
  const out = catalogDefaults(info);
  for (const [prop, raw] of Object.entries(instance)) {
    if (!RESERVED.has(prop) && raw !== undefined) out[prop] = ctx.client.resolve(ctx.surfaceId, raw, scope);
  }
  const refs = info === undefined ? {} : childRefKinds(info);
  for (const prop of Object.keys(refs)) if (instance[prop] !== undefined) out[prop] = instance[prop];
  return out;
}

function templateChildren(ctx: SurfaceContextValue, list: unknown, scope: Scope): ReactNode[] {
  if (Array.isArray(list)) return list.filter((id): id is string => typeof id === 'string').map((id) => <A2uiNode key={id} id={id} scope={scope} />);
  if (!isChildTemplate(list)) return [];
  const base = resolveScopedPath(list.path, scope.path);
  const items = getAt(ctx.client.dataModel(ctx.surfaceId), base);
  if (!Array.isArray(items)) return [];
  return items.map((_, index) => {
    const itemScope: Scope = { path: `${base === '/' ? '' : base}/${index}`, indices: [...scope.indices, index] };
    return <A2uiNode key={`${list.componentId}:${index}`} id={list.componentId} scope={itemScope} />;
  });
}

function useBindings(ctx: SurfaceContextValue, instance: ComponentInstance, scope: Scope, resolved: Record<string, unknown>) {
  const [local, setLocal] = useState<Record<string, JsonValue>>({});
  const [touched, setTouched] = useState(false);
  const binding = <T extends JsonValue>(prop: string): Binding<T> => {
    const raw = instance[prop];
    const value = (Object.hasOwn(local, prop) && !isDataBinding(raw) ? local[prop] : resolved[prop]) as T | undefined;
    return {
      value,
      set: (next: T) => {
        setTouched(true);
        if (isDataBinding(raw)) ctx.client.write(ctx.surfaceId, resolveScopedPath(raw['@path'], scope.path), next);
        else setLocal((prev) => ({ ...prev, [prop]: next }));
      },
    };
  };
  return { binding, touched };
}

function A2uiNode({ id, scope }: { id: string; scope: Scope }): React.ReactElement | null {
  const ctx = useContext(SurfaceContext);
  const instance = ctx?.client.surface(ctx.surfaceId)?.components.get(id);
  const render = instance === undefined ? undefined : ctx?.renderers[instance.component];
  if (ctx === null || instance === undefined || render === undefined) return null;
  return <ResolvedNode ctx={ctx} instance={instance} scope={scope} render={render} />;
}

function ResolvedNode({ ctx, instance, scope, render }: { ctx: SurfaceContextValue; instance: ComponentInstance; scope: Scope; render: A2uiRenderer }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const palette = useKitPalette();
  const contentColor = useContentColor();
  const resolved = resolveProps(ctx, instance, scope);
  const bindings = useBindings(ctx, instance, scope, resolved);
  const renderContext: RenderContext = {
    id: instance.id,
    instance,
    props: resolved,
    accessibility: resolveAccessibility(ctx, instance.accessibility, scope),
    weight: asNumber(ctx.client.resolve(ctx.surfaceId, instance.weight, scope)),
    scope,
    dark,
    palette,
    contentColor,
    checks: ctx.client.checks(ctx.surfaceId, isCheckRuleList(instance.checks) ? instance.checks : undefined, scope),
    touched: bindings.touched,
    disabled: ctx.disabled === true,
    mediaUrl: (value) => { const url = asString(value); return ctx.mediaUrl === undefined ? url : ctx.mediaUrl(url); },
    child: (childId) => (typeof childId === 'string' ? <A2uiNode id={childId} scope={scope} /> : null),
    children: (list) => templateChildren(ctx, list, scope),
    childText: (childId) => plainChildText(ctx, childId, scope),
    action: () => dispatchAction(ctx, instance.id, instance.action, scope),
    dispatch: (action) => dispatchAction(ctx, instance.id, action, scope),
    binding: bindings.binding,
    pointer: (path) => resolveScopedPath(path, scope.path),
    read: (pointer) => getAt(ctx.client.dataModel(ctx.surfaceId), pointer),
    write: (pointer, value) => { ctx.client.write(ctx.surfaceId, pointer, value); },
  };
  return <>{render(renderContext)}</>;
}

const PLAIN_TEXT_PROPS = new Set(['id', 'component', 'text', 'catalogId']);

function plainChildText(ctx: SurfaceContextValue, childId: unknown, scope: Scope): string | undefined {
  const child = typeof childId === 'string' ? ctx.client.surface(ctx.surfaceId)?.components.get(childId) : undefined;
  if (child?.component !== 'Text' || Object.keys(child).some((key) => !PLAIN_TEXT_PROPS.has(key))) return undefined;
  const text = ctx.client.resolve(ctx.surfaceId, child.text, scope);
  return typeof text === 'string' && !hasMarkdown(text) ? text : undefined;
}

function dispatchAction(ctx: SurfaceContextValue, sourceId: string, action: unknown, scope: Scope): ReturnType<RenderContext['action']> {
  if (ctx.disabled === true || (!isEventAction(action) && !isFunctionAction(action))) return undefined;
  const result = ctx.client.dispatch(ctx.surfaceId, sourceId, action, scope);
  if (!result.ok && result.error !== undefined) ctx.onActionError?.(result.error);
  return result;
}
