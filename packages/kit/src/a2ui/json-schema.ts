import { entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { formatPointer, parsePointer } from './pointer';
import { checkArray, checkNumber, checkString, checkType, jsonEqual, patternMatches } from './json-schema.keywords';

export interface SchemaIssue {
  path: string;
  message: string;
}

export interface SchemaRegistry {
  resolveDocument: (name: string, self: JsonObject | undefined) => JsonObject | undefined;
}

interface Scope {
  registry: SchemaRegistry;
  doc: JsonObject;
  catalog: JsonObject | undefined;
  depth: number;
}

interface Outcome {
  issues: SchemaIssue[];
  evaluated: Set<string>;
}

const COMMON_TYPES = 'common_types.json';
const GENERIC_CATALOG = 'catalog.json';
const META_SCHEMA = 'https://json-schema.org/draft/2020-12/schema';
const MAX_DEPTH = 200;

function lastSegment(value: string): string {
  const parts = value.split('/');
  return parts[parts.length - 1] ?? value;
}

function documentIds(doc: JsonObject): string[] {
  return [doc.$id, doc.catalogId].filter((v): v is string => typeof v === 'string');
}

function suffixMatch(id: string, name: string): boolean {
  return id === name || id.endsWith(`/${name}`) || name.endsWith(`/${id}`);
}

function findPeer(docs: readonly JsonObject[], match: (id: string) => boolean): JsonObject | undefined {
  return docs.find((doc) => documentIds(doc).some(match));
}

export function createSchemaRegistry(docs: readonly JsonObject[]): SchemaRegistry {
  const common = docs.find((doc) => documentIds(doc).some((id) => lastSegment(id) === COMMON_TYPES));
  return {
    resolveDocument(name, self) {
      if (name === COMMON_TYPES || name.endsWith(`/${COMMON_TYPES}`)) return common;
      if (name === GENERIC_CATALOG) return self;
      const exact = findPeer(docs, (id) => suffixMatch(id, name));
      if (exact !== undefined) return exact;
      if (name.endsWith(`/${GENERIC_CATALOG}`)) return self;
      return findPeer(docs, (id) => lastSegment(id) === lastSegment(name));
    },
  };
}

function resolveFragment(doc: JsonObject, fragment: string): JsonValue | undefined {
  let node: JsonValue | undefined = doc;
  for (const token of parsePointer(fragment)) {
    if (Array.isArray(node)) node = node[Number(token)];
    else if (isJsonObject(node)) node = node[token];
    else return undefined;
  }
  return node;
}

const CLOSURE_KEYWORDS = new Set(['unevaluatedProperties', 'additionalProperties']);

function withoutDiscriminator(schema: JsonValue): JsonValue {
  if (!isJsonObject(schema)) return schema;
  const out: JsonObject = {};
  for (const [key, value] of entriesOf(schema)) {
    if (CLOSURE_KEYWORDS.has(key)) continue;
    if (key === 'properties' && isJsonObject(value))
      out[key] = Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'component'));
    else if (key === 'required' && Array.isArray(value)) out[key] = value.filter((name) => name !== 'component');
    else if (key === 'allOf' && Array.isArray(value)) out[key] = value.map(withoutDiscriminator);
    else out[key] = value;
  }
  return out;
}

function inheritsComponent(fragment: string, doc: JsonObject, from: JsonObject): boolean {
  return doc !== from && typeof doc.catalogId === 'string' && /^\/components\/[^/]+$/.test(fragment);
}

function resolveRef(ref: string, scope: Scope): { schema: JsonValue; scope: Scope } | undefined {
  if (ref === META_SCHEMA) return { schema: true, scope };
  const hash = ref.indexOf('#');
  const docName = hash === -1 ? ref : ref.slice(0, hash);
  const fragment = hash === -1 ? '' : decodeURIComponent(ref.slice(hash + 1));
  const doc = docName === '' ? scope.doc : scope.registry.resolveDocument(docName, scope.catalog);
  if (doc === undefined) return undefined;
  const found = resolveFragment(doc, fragment);
  if (found === undefined) return undefined;
  const schema = inheritsComponent(fragment, doc, scope.doc) ? withoutDiscriminator(found) : found;
  return { schema, scope: { ...scope, doc, depth: scope.depth + 1 } };
}

function issue(path: readonly string[], message: string): SchemaIssue {
  return { path: formatPointer(path), message };
}

function passed(outcome: Outcome): boolean {
  return outcome.issues.length === 0;
}

function merge(into: Outcome, from: Outcome): void {
  into.issues.push(...from.issues);
  for (const key of from.evaluated) into.evaluated.add(key);
}

function checkRef(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (typeof schema.$ref !== 'string') return;
  const target = resolveRef(schema.$ref, scope);
  if (target === undefined) {
    out.issues.push(issue(path, `Unresolvable schema reference '${schema.$ref}'.`));
    return;
  }
  merge(out, check(target.schema, value, path, target.scope));
}

function checkAllOf(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (!Array.isArray(schema.allOf)) return;
  for (const sub of schema.allOf) merge(out, check(sub, value, path, scope));
}

function bestFailure(results: readonly Outcome[]): SchemaIssue[] {
  const sorted = [...results].sort((a, b) => a.issues.length - b.issues.length);
  return sorted[0]?.issues ?? [];
}

function checkAnyOf(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (!Array.isArray(schema.anyOf)) return;
  const results = schema.anyOf.map((sub) => check(sub, value, path, scope));
  const ok = results.filter(passed);
  if (ok.length === 0) {
    out.issues.push(...bestFailure(results));
    return;
  }
  for (const result of ok) merge(out, result);
}

function checkOneOf(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (!Array.isArray(schema.oneOf)) return;
  const results = schema.oneOf.map((sub) => check(sub, value, path, scope));
  const ok = results.filter(passed);
  const [first] = ok;
  if (ok.length === 1 && first !== undefined) {
    merge(out, first);
    return;
  }
  if (ok.length === 0) out.issues.push(...bestFailure(results));
  else out.issues.push(issue(path, 'Value matches more than one allowed shape.'));
}

function checkNot(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (schema.not === undefined) return;
  if (passed(check(schema.not, value, path, scope))) out.issues.push(issue(path, 'Value matches a disallowed shape.'));
}

function checkConditional(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (schema.if === undefined) return;
  const condition = check(schema.if, value, path, scope);
  if (passed(condition)) {
    merge(out, condition);
    if (schema.then !== undefined) merge(out, check(schema.then, value, path, scope));
  } else if (schema.else !== undefined) {
    merge(out, check(schema.else, value, path, scope));
  }
}

function propertySchemas(schema: JsonObject, key: string): JsonValue[] {
  const props = isJsonObject(schema.properties) ? schema.properties : {};
  const subs: JsonValue[] = Object.prototype.hasOwnProperty.call(props, key) ? [props[key] ?? true] : [];
  const patterns = isJsonObject(schema.patternProperties) ? entriesOf(schema.patternProperties) : [];
  for (const [pattern, sub] of patterns) if (patternMatches(pattern, key)) subs.push(sub);
  if (subs.length === 0 && schema.additionalProperties !== undefined) subs.push(schema.additionalProperties);
  return subs;
}

function checkProperties(schema: JsonObject, value: JsonObject, path: string[], scope: Scope, out: Outcome): void {
  for (const [key, child] of entriesOf(value)) {
    const subs = propertySchemas(schema, key);
    for (const sub of subs) out.issues.push(...check(sub, child, [...path, key], scope).issues);
    if (subs.length > 0) out.evaluated.add(key);
  }
}

function checkRequired(schema: JsonObject, keys: readonly string[], path: string[], out: Outcome): void {
  if (!Array.isArray(schema.required)) return;
  for (const key of schema.required) {
    if (typeof key === 'string' && !keys.includes(key)) out.issues.push(issue(path, `Missing required property '${key}'.`));
  }
}

function checkObjectShape(schema: JsonObject, value: JsonObject, path: string[], scope: Scope, out: Outcome): void {
  const keys = entriesOf(value).map(([key]) => key);
  checkRequired(schema, keys, path, out);
  if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties)
    out.issues.push(issue(path, `Expected at least ${schema.minProperties} properties.`));
  if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties)
    out.issues.push(issue(path, `Expected at most ${schema.maxProperties} properties.`));
  const names = schema.propertyNames;
  if (names !== undefined) for (const key of keys) out.issues.push(...check(names, key, [...path, key], scope).issues);
}

function checkUnevaluated(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  if (schema.unevaluatedProperties === undefined || !isJsonObject(value)) return;
  for (const [key, child] of entriesOf(value)) {
    if (out.evaluated.has(key)) continue;
    if (schema.unevaluatedProperties === false) out.issues.push(issue([...path, key], `Unexpected property '${key}'.`));
    else out.issues.push(...check(schema.unevaluatedProperties, child, [...path, key], scope).issues);
    out.evaluated.add(key);
  }
}

function checkItems(schema: JsonObject, value: readonly JsonValue[], path: string[], scope: Scope, out: Outcome): void {
  const { items, contains } = schema;
  const at = (sub: JsonValue, item: JsonValue, index: number): Outcome => check(sub, item, [...path, String(index)], scope);
  if (items !== undefined) value.forEach((item, index) => out.issues.push(...at(items, item, index).issues));
  if (contains !== undefined && !value.some((item, index) => passed(at(contains, item, index))))
    out.issues.push(issue(path, 'Expected at least one matching item.'));
}

function checkValueKeywords(schema: JsonObject, value: JsonValue, path: string[], scope: Scope, out: Outcome): void {
  const typeIssue = checkType(schema.type, value);
  if (typeIssue !== undefined) out.issues.push(issue(path, typeIssue));
  if (schema.const !== undefined && !jsonEqual(schema.const, value))
    out.issues.push(issue(path, `Expected the constant ${JSON.stringify(schema.const)}.`));
  if (Array.isArray(schema.enum) && !schema.enum.some((option) => jsonEqual(option, value))) {
    out.issues.push(issue(path, `Expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}.`));
  }
  for (const message of [...checkString(schema, value), ...checkNumber(schema, value), ...checkArray(schema, value)])
    out.issues.push(issue(path, message));
  if (Array.isArray(value)) checkItems(schema, value, path, scope, out);
  if (isJsonObject(value)) {
    checkObjectShape(schema, value, path, scope, out);
    checkProperties(schema, value, path, scope, out);
  }
}

export function check(schema: JsonValue | undefined, value: JsonValue, path: string[], scope: Scope): Outcome {
  const out: Outcome = { issues: [], evaluated: new Set() };
  if (schema === undefined || schema === true) return out;
  if (schema === false) return { issues: [issue(path, 'No value is allowed here.')], evaluated: out.evaluated };
  if (!isJsonObject(schema)) return out;
  if (scope.depth > MAX_DEPTH) return { issues: [issue(path, 'Schema nesting is too deep.')], evaluated: out.evaluated };
  checkValueKeywords(schema, value, path, scope, out);
  checkRef(schema, value, path, scope, out);
  checkAllOf(schema, value, path, scope, out);
  checkAnyOf(schema, value, path, scope, out);
  checkOneOf(schema, value, path, scope, out);
  checkNot(schema, value, path, scope, out);
  checkConditional(schema, value, path, scope, out);
  checkUnevaluated(schema, value, path, scope, out);
  return out;
}

export interface ValidateOptions {
  registry: SchemaRegistry;
  document: JsonObject;
  catalog?: JsonObject;
  path?: string[];
}

export function validateJson(schema: JsonValue, value: JsonValue, options: ValidateOptions): SchemaIssue[] {
  const scope: Scope = { registry: options.registry, doc: options.document, catalog: options.catalog, depth: 0 };
  return check(schema, value, options.path ?? [], scope).issues;
}
