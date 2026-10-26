import type { CatalogRegistry, ComponentInfo } from './catalog';
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

export function childReferences(info: ComponentInfo, instance: ComponentInstance): string[] {
  const out: string[] = [];
  for (const [prop, meta] of Object.entries(info.properties)) {
    const value = instance[prop];
    if (value === undefined || isAccessibilityLike(prop)) continue;
    out.push(...refsIn(meta.schema, value));
  }
  return out;
}

function isAccessibilityLike(prop: string): boolean {
  return prop === 'accessibility' || prop === 'metadata';
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

interface Edge {
  parentType: string;
  parentInfo: ComponentInfo | undefined;
  child: ComponentInstance;
  childInfo: ComponentInfo | undefined;
}

function edgeIssues(edge: Edge): CompositionIssue[] {
  const { parentType, parentInfo, child, childInfo } = edge;
  const out: CompositionIssue[] = [];
  const parents = childInfo?.allowedParents;
  if (parents !== undefined && !parents.includes(parentType)) {
    out.push({ code: ERROR_CODES.unallowedParent, componentId: child.id, message: `'${child.component}' cannot be placed inside '${parentType}'.` });
  }
  const children = parentInfo?.allowedChildren;
  if (children !== undefined && !children.includes(child.component)) {
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
  const out: CompositionIssue[] = [];
  const root = components.get(ROOT_ID);
  if (root !== undefined) out.push(...edgeIssues({ parentType: SURFACE_COMPONENT, parentInfo: undefined, child: root, childInfo: infoOf(root) }));
  for (const parent of components.values()) {
    const parentInfo = infoOf(parent);
    if (parentInfo === undefined) continue;
    for (const childId of childReferences(parentInfo, parent)) {
      const child = components.get(childId);
      if (child !== undefined) out.push(...edgeIssues({ parentType: parent.component, parentInfo, child, childInfo: infoOf(child) }));
    }
  }
  return out;
}
