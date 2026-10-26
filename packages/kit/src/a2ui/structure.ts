import type { CatalogRegistry, ComponentInfo } from './catalog';
import { getAt, resolveScopedPath } from './pointer';
import type { SurfaceState } from './surface';
import {
  ERROR_CODES, ROOT_ID, SURFACE_COMPONENT, entriesOf, isChildTemplate, isJsonObject,
  type ComponentInstance, type JsonObject, type JsonValue,
} from './protocol';

export type ChildRefKind = 'child' | 'children';

const CHILD_REFS = ['#/$defs/ComponentId', '#/$defs/Child'];
const CHILD_LIST_REF = '#/$defs/ChildList';

function refKind(schema: JsonObject): ChildRefKind | undefined {
  const refs = [schema.$ref, ...(Array.isArray(schema.allOf) ? schema.allOf.map((p) => (isJsonObject(p) ? p.$ref : undefined)) : [])];
  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    if (ref.endsWith(CHILD_LIST_REF)) return 'children';
    if (CHILD_REFS.some((suffix) => ref.endsWith(suffix))) return 'child';
  }
  return undefined;
}

function idsOfList(value: JsonValue | undefined): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return isChildTemplate(value) ? [value.componentId] : [];
}

function refsIn(schema: JsonObject, value: JsonValue | undefined): string[] {
  const kind = refKind(schema);
  if (kind === 'child') return typeof value === 'string' ? [value] : [];
  if (kind === 'children') return idsOfList(value);
  if (Array.isArray(value) && isJsonObject(schema.items)) {
    const items = schema.items;
    return value.flatMap((item) => refsIn(items, item));
  }
  if (isJsonObject(value) && isJsonObject(schema.properties)) {
    const props = schema.properties;
    return entriesOf(value).flatMap(([key, child]) => {
      const sub = props[key];
      return isJsonObject(sub) ? refsIn(sub, child) : [];
    });
  }
  return [];
}

function childReferences(info: ComponentInfo, instance: ComponentInstance): string[] {
  return Object.entries(info.properties).flatMap(([prop, meta]) => {
    const value = instance[prop];
    return value === undefined || prop === 'accessibility' || prop === 'metadata' ? [] : refsIn(meta.schema, value);
  });
}

export function childRefKinds(info: ComponentInfo): Record<string, ChildRefKind> {
  const out: Record<string, ChildRefKind> = {};
  for (const [prop, meta] of Object.entries(info.properties)) {
    const kind = refKind(meta.schema);
    if (kind !== undefined) out[prop] = kind;
  }
  return out;
}

export interface CompositionIssue {
  code: typeof ERROR_CODES.unallowedParent | typeof ERROR_CODES.unallowedChild;
  componentId: string;
  message: string;
}

function edgeIssues(parentType: string, parentInfo: ComponentInfo | undefined, child: ComponentInstance, childInfo: ComponentInfo | undefined): CompositionIssue[] {
  const out: CompositionIssue[] = [];
  if (childInfo?.allowedParents?.includes(parentType) === false) {
    out.push({ code: ERROR_CODES.unallowedParent, componentId: child.id, message: `'${child.component}' cannot be placed inside '${parentType}'.` });
  }
  if (parentInfo?.allowedChildren?.includes(child.component) === false) {
    out.push({ code: ERROR_CODES.unallowedChild, componentId: child.id, message: `'${parentType}' cannot contain '${child.component}'.` });
  }
  return out;
}

export function compositionIssues(
  components: ReadonlyMap<string, ComponentInstance>,
  registry: CatalogRegistry,
  defaultCatalogId: string | undefined,
): CompositionIssue[] {
  const infoOf = (c: ComponentInstance): ComponentInfo | undefined => {
    const id = c.catalogId ?? defaultCatalogId;
    return id === undefined ? undefined : registry.component(id, c.component);
  };
  const root = components.get(ROOT_ID);
  const out = root === undefined ? [] : edgeIssues(SURFACE_COMPONENT, undefined, root, infoOf(root));
  for (const parent of components.values()) {
    const parentInfo = infoOf(parent);
    if (parentInfo === undefined) continue;
    for (const childId of childReferences(parentInfo, parent)) {
      const child = components.get(childId);
      if (child !== undefined) out.push(...edgeIssues(parent.component, parentInfo, child, infoOf(child)));
    }
  }
  return out;
}

export const RENDER_LIMITS = { depth: 32, nodes: 2000 } as const;

interface Walk {
  surface: SurfaceState;
  registry: CatalogRegistry;
  left: number;
}

function templateScopes(walk: Walk, instance: ComponentInstance, info: ComponentInfo, scopePath: string): [string, string][] {
  return Object.keys(childRefKinds(info)).flatMap((prop): [string, string][] => {
    const template = instance[prop];
    if (!isChildTemplate(template)) return [];
    const base = resolveScopedPath(template.path, scopePath);
    const items = getAt(walk.surface.data, base);
    const count = Array.isArray(items) ? items.length : 0;
    return Array.from({ length: count }, (_, index): [string, string] => [template.componentId, `${base === '/' ? '' : base}/${index}`]);
  });
}

function fits(walk: Walk, id: string, lineage: readonly string[], scopePath: string): boolean {
  walk.left -= 1;
  if (walk.left < 0 || lineage.length >= RENDER_LIMITS.depth || lineage.includes(id)) return false;
  const instance = walk.surface.components.get(id);
  const info = instance === undefined ? undefined : walk.registry.component(instance.catalogId ?? walk.surface.catalogId ?? '', instance.component);
  if (instance === undefined || info === undefined) return true;
  const next = [...lineage, id];
  const templates = templateScopes(walk, instance, info, scopePath);
  const templateIds = new Set(templates.map(([childId]) => childId));
  const direct = childReferences(info, instance).filter((childId) => !templateIds.has(childId));
  return direct.every((childId) => fits(walk, childId, next, scopePath))
    && templates.every(([childId, path]) => fits(walk, childId, next, path));
}

export function fitsRenderLimits(surface: SurfaceState, registry: CatalogRegistry): boolean {
  return fits({ surface, registry, left: RENDER_LIMITS.nodes }, ROOT_ID, [], '/');
}

