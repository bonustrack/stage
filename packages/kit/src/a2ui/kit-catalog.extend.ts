import { KIT_CATALOG, KIT_CATALOG_ID } from './kit-catalog';
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
  const components = { ...base, ...added };
  const functions = isJsonObject(KIT_CATALOG.functions) ? KIT_CATALOG.functions : {};
  const baseInstructions = typeof KIT_CATALOG.instructions === 'string' ? KIT_CATALOG.instructions : '';
  return {
    ...KIT_CATALOG,
    $id: extension.catalogId,
    catalogId: extension.catalogId,
    title: extension.title ?? 'Stage Kit Catalog (extended)',
    description:
      extension.description ?? `The Stage Kit catalog (${KIT_CATALOG_ID}) with host components: ${Object.keys(added).join(', ')}.`,
    instructions: extension.instructions === undefined ? baseInstructions : `${baseInstructions}\n\n${extension.instructions}`,
    components,
    $defs: {
      anyComponent: {
        oneOf: Object.keys(components).map((name) => ({ $ref: `#/components/${name}` })),
        discriminator: { propertyName: 'component' },
      },
      anyFunction: { oneOf: Object.keys(functions).map((name) => ({ $ref: `#/functions/${name}` })) },
    },
  };
}
