import { describe, expect, test } from 'bun:test';
import { createA2uiClient } from '../../src/a2ui/client';
import { createCatalogRegistry } from '../../src/a2ui/catalog';
import { ROOT_SCOPE } from '../../src/a2ui/evaluate';
import { createSchemaRegistry, validateJson } from '../../src/a2ui/json-schema';
import { KIT_CATALOG } from '../../src/a2ui/kit-catalog';
import { extendKitCatalog } from '../../src/a2ui/kit-catalog.extend';
import { BASIC_CATALOG, PROTOCOL_DOCUMENTS, PROTOCOL_SCHEMAS } from '../../src/a2ui/schemas';

const HOST_ID = 'https://dashboard.example/a2ui/catalog.json';
const host = extendKitCatalog({
  catalogId: HOST_ID,
  instructions: 'ChatThread shows a live chat.',
  components: {
    ChatThread: {
      type: 'object',
      description: 'A live chat thread.',
      properties: { threadId: { $ref: 'common_types.json#/$defs/DynamicString' } },
      required: ['threadId'],
    },
  },
});

describe('extendKitCatalog', () => {
  test('builds a valid A2UI catalog definition under the host id', () => {
    const registry = createSchemaRegistry([...PROTOCOL_DOCUMENTS, BASIC_CATALOG, KIT_CATALOG, host]);
    const document = PROTOCOL_SCHEMAS.catalogDefinition;
    expect(validateJson(document, host, { registry, document })).toEqual([]);
    expect(host.catalogId).toBe(HOST_ID);
    expect(String(host.instructions).endsWith('ChatThread shows a live chat.')).toBe(true);
  });

  test('validates host components next to every Kit component', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG, host]);
    expect(registry.validateComponent(HOST_ID, { id: 't', component: 'ChatThread', threadId: { '@path': '/thread' } }, [])).toEqual([]);
    expect(registry.validateComponent(HOST_ID, { id: 't', component: 'ChatThread' }, []).length).toBeGreaterThan(0);
    expect(registry.validateComponent(HOST_ID, { id: 'c', component: 'Column', children: ['t'], radius: 14 }, [])).toEqual([]);
    expect(registry.validateComponent(HOST_ID, { id: 'x', component: 'Nope' }, []).length).toBeGreaterThan(0);
  });

  test('runs the Kit functions for surfaces in the host catalog', () => {
    const client = createA2uiClient({ catalogs: [BASIC_CATALOG, KIT_CATALOG, host] });
    client.receive([{ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: HOST_ID, dataModel: { a: 'x', b: 'x' } } }]);
    const rules = [
      { condition: { '@call': 'equals', args: { value: { '@path': '/a' }, other: { '@path': '/b' } } }, message: 'Different.' },
    ];
    expect(client.checks('s', rules as never, ROOT_SCOPE)[0]?.valid).toBe(true);
    expect(client.capabilities()['v1.0']?.supportedCatalogIds).toContain(HOST_ID);
  });
});
