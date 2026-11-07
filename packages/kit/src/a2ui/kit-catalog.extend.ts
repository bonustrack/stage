import type { FunctionImpl } from './functions';
import { KIT_CATALOG, KIT_CATALOG_ID, catalogDocument } from './kit-catalog';
import { KIT_FUNCTIONS } from './kit-catalog.functions';
import { isJsonObject, type JsonObject } from './protocol';

export interface KitCatalogExtension {
  catalogId: string;
  components: Record<string, JsonObject>;
  title?: string;
  description?: string;
  instructions?: string;
}

function withComponentName(name: string, schema: JsonObject): JsonObject {
  if (!isJsonObject(schema.properties) || schema.properties.component !== undefined) return schema;
  const required = Array.isArray(schema.required) ? schema.required : [];
  return {
    ...schema,
    properties: { component: { const: name }, ...schema.properties },
    required: ['component', ...required.filter((key) => key !== 'component')],
  };
}

export function extendKitCatalog(extension: KitCatalogExtension): JsonObject {
  const base = isJsonObject(KIT_CATALOG.components) ? KIT_CATALOG.components : {};
  const added = Object.fromEntries(Object.entries(extension.components).map(([name, schema]) => [name, withComponentName(name, schema)]));
  const baseInstructions = typeof KIT_CATALOG.instructions === 'string' ? KIT_CATALOG.instructions : '';
  return catalogDocument({
    id: extension.catalogId,
    title: extension.title ?? 'Stage Kit Catalog (extended)',
    description:
      extension.description ?? `The Stage Kit catalog (${KIT_CATALOG_ID}) with host components: ${Object.keys(added).join(', ')}.`,
    instructions: extension.instructions === undefined ? baseInstructions : `${baseInstructions}\n\n${extension.instructions}`,
    components: { ...base, ...added },
    functions: KIT_FUNCTIONS,
  });
}

export function inheritKitFunctions(catalog: JsonObject, kit: Record<string, FunctionImpl>): Record<string, FunctionImpl> {
  const declared = isJsonObject(catalog.functions) ? Object.keys(catalog.functions) : [];
  return Object.fromEntries(declared.flatMap((name) => (kit[name] === undefined ? [] : [[name, kit[name]]])));
}
