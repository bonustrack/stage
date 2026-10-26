import { createSchemaRegistry, validateJson, type SchemaIssue, type SchemaRegistry } from './json-schema';
import { parsePointer } from './pointer';
import { entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { PROTOCOL_DOCUMENTS, PROTOCOL_SCHEMAS } from './schemas';

export type AllowedCallers = 'rendererOnly' | 'agentOnly' | 'rendererOrAgent';

export interface FunctionMeta {
  returnType: string;
  allowedCallers: AllowedCallers;
  requiresUserActivation: boolean;
}

export interface PropertyInfo {
  schema: JsonObject;
  default?: JsonValue;
}

export interface ComponentInfo {
  name: string;
  catalogId: string;
  properties: Record<string, PropertyInfo>;
  required: string[];
  allowedParents?: string[];
  allowedChildren?: string[];
}

export interface CatalogRegistry {
  schemas: SchemaRegistry;
  catalogIds: () => string[];
  catalog: (catalogId: string) => JsonObject | undefined;
  component: (catalogId: string, name: string) => ComponentInfo | undefined;
  functionMeta: (catalogId: string, name: string) => FunctionMeta | undefined;
  validateComponent: (catalogId: string, instance: JsonValue, path: string[]) => SchemaIssue[];
  validateFunctionCall: (catalogId: string, call: JsonValue, path: string[]) => SchemaIssue[];
  validateAgentEnvelope: (message: JsonValue) => SchemaIssue[];
  validateRendererMessage: (message: JsonValue) => SchemaIssue[];
}

const ENVELOPE_CATALOG: JsonObject = {
  $id: 'urn:stage-kit:a2ui:envelope-catalog',
  catalogId: 'urn:stage-kit:a2ui:envelope-catalog',
  $defs: {
    anyComponent: { type: 'object', required: ['component'], properties: { component: { type: 'string' } }, additionalProperties: true },
    anyFunction: {
      type: 'object',
      required: ['@call'],
      properties: { '@call': { type: 'string', not: { const: '@index' } } },
      additionalProperties: true,
    },
  },
};

const CALLERS = new Set<AllowedCallers>(['rendererOnly', 'agentOnly', 'rendererOrAgent']);

function stringList(value: JsonValue | undefined): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

interface Located {
  schema: JsonObject;
  doc: JsonObject;
}

function follow(ref: string, doc: JsonObject, schemas: SchemaRegistry): Located | undefined {
  const hash = ref.indexOf('#');
  const name = hash === -1 ? ref : ref.slice(0, hash);
  const target = name === '' ? doc : schemas.resolveDocument(name, doc);
  if (target === undefined) return undefined;
  let node: JsonValue | undefined = target;
  for (const token of parsePointer(hash === -1 ? '' : ref.slice(hash + 1))) node = isJsonObject(node) ? node[token] : undefined;
  return isJsonObject(node) ? { schema: node, doc: target } : undefined;
}

function refsOf(schema: JsonObject): string[] {
  const parts = Array.isArray(schema.allOf) ? schema.allOf : [];
  return [schema.$ref, ...parts.map((p) => (isJsonObject(p) ? p.$ref : undefined))].filter((r): r is string => typeof r === 'string');
}

function addOwnProperties(schema: JsonObject, out: ComponentInfo): void {
  if (isJsonObject(schema.properties)) {
    for (const [key, prop] of entriesOf(schema.properties)) {
      if (key === 'component' || !isJsonObject(prop)) continue;
      out.properties[key] = prop.default === undefined ? { schema: prop } : { schema: prop, default: prop.default };
    }
  }
  for (const key of stringList(schema.required) ?? []) {
    if (key !== 'component' && !out.required.includes(key)) out.required.push(key);
  }
}

function collectProperties(located: Located, schemas: SchemaRegistry, out: ComponentInfo, depth = 0): void {
  if (depth > 20) return;
  const { schema, doc } = located;
  if (typeof schema.$ref === 'string') {
    const next = follow(schema.$ref, doc, schemas);
    if (next !== undefined) collectProperties(next, schemas, out, depth + 1);
  }
  const parts = Array.isArray(schema.allOf) ? schema.allOf : [];
  for (const part of parts) if (isJsonObject(part)) collectProperties({ schema: part, doc }, schemas, out, depth + 1);
  addOwnProperties(schema, out);
}

function ownMeta(schema: JsonObject): FunctionMeta | undefined {
  if (typeof schema.returnType !== 'string') return undefined;
  const callers = schema.allowedCallers;
  const allowedCallers = typeof callers === 'string' && CALLERS.has(callers as AllowedCallers) ? (callers as AllowedCallers) : 'rendererOnly';
  return { returnType: schema.returnType, allowedCallers, requiresUserActivation: schema.requiresUserActivation === true };
}

function functionMetaOf(located: Located, schemas: SchemaRegistry, depth = 0): FunctionMeta | undefined {
  const own = ownMeta(located.schema);
  if (own !== undefined || depth > 20) return own;
  for (const ref of refsOf(located.schema)) {
    const next = follow(ref, located.doc, schemas);
    const meta = next === undefined ? undefined : functionMetaOf(next, schemas, depth + 1);
    if (meta !== undefined) return meta;
  }
  return undefined;
}

function componentInfo(catalogId: string, catalog: JsonObject, name: string, schemas: SchemaRegistry): ComponentInfo | undefined {
  const components = isJsonObject(catalog.components) ? catalog.components : {};
  const schema = components[name];
  if (!isJsonObject(schema)) return undefined;
  const info: ComponentInfo = { name, catalogId, properties: {}, required: [] };
  collectProperties({ schema, doc: catalog }, schemas, info);
  const parents = stringList(schema.allowedParents);
  const children = stringList(schema.allowedChildren);
  if (parents !== undefined) info.allowedParents = parents;
  if (children !== undefined) info.allowedChildren = children;
  return info;
}

function componentEnvelope(name: string): JsonObject {
  return {
    allOf: [
      { $ref: 'common_types.json#/$defs/ComponentCommon' },
      { $ref: `#/components/${name}` },
      { type: 'object', properties: { component: { not: { const: 'Surface' } } } },
    ],
    unevaluatedProperties: false,
  };
}

function issueAt(path: readonly string[], message: string): SchemaIssue[] {
  return [{ path: `/${path.join('/')}`, message }];
}

export function createCatalogRegistry(catalogs: readonly JsonObject[]): CatalogRegistry {
  const byId = new Map(catalogs.flatMap((catalog): [string, JsonObject][] => (typeof catalog.catalogId === 'string' ? [[catalog.catalogId, catalog]] : [])));
  const schemas = createSchemaRegistry([...PROTOCOL_DOCUMENTS, ...catalogs]);
  const envelopeSchemas = createSchemaRegistry([...PROTOCOL_DOCUMENTS, ...catalogs, ENVELOPE_CATALOG]);
  const components = new Map<string, ComponentInfo | undefined>();
  const component = (id: string, name: string): ComponentInfo | undefined => {
    const key = `${id}\n${name}`;
    if (!components.has(key)) {
      const catalog = byId.get(id);
      components.set(key, catalog === undefined ? undefined : componentInfo(id, catalog, name, schemas));
    }
    return components.get(key);
  };
  const validateIn = (catalog: JsonObject, schema: JsonObject, value: JsonValue, path: string[]): SchemaIssue[] =>
    validateJson(schema, value, { registry: schemas, document: catalog, catalog, path });
  const validateEnvelope = (document: JsonObject, message: JsonValue): SchemaIssue[] =>
    validateJson(document, message, { registry: envelopeSchemas, document, catalog: ENVELOPE_CATALOG });
  return {
    schemas,
    catalogIds: () => [...byId.keys()],
    catalog: (id) => byId.get(id),
    component,
    functionMeta(id, name) {
      const catalog = byId.get(id);
      const fn = catalog !== undefined && isJsonObject(catalog.functions) ? catalog.functions[name] : undefined;
      return catalog === undefined || !isJsonObject(fn) ? undefined : functionMetaOf({ schema: fn, doc: catalog }, schemas);
    },
    validateComponent(id, instance, path) {
      const catalog = byId.get(id);
      if (catalog === undefined) return issueAt(path, `Unknown catalog '${id}'.`);
      const name = isJsonObject(instance) && typeof instance.component === 'string' ? instance.component : undefined;
      if (name === undefined || component(id, name) === undefined) {
        return issueAt([...path, 'component'], `Component '${String(name)}' is not defined in catalog '${id}'.`);
      }
      return validateIn(catalog, componentEnvelope(name), instance, path);
    },
    validateFunctionCall(id, call, path) {
      const catalog = byId.get(id);
      if (catalog === undefined) return issueAt(path, `Unknown catalog '${id}'.`);
      return validateIn(catalog, { $ref: 'common_types.json#/$defs/FunctionCall' }, call, path);
    },
    validateAgentEnvelope: (message) => validateEnvelope(PROTOCOL_SCHEMAS.agentToRenderer, message),
    validateRendererMessage: (message) => validateEnvelope(PROTOCOL_SCHEMAS.rendererToAgent, message),
  };
}
