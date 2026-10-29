import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSchemaRegistry, validateJson } from '../../src/a2ui/json-schema';
import { BASIC_CATALOG, PROTOCOL_DOCUMENTS } from '../../src/a2ui/schemas';
import { isJsonObject, type JsonObject, type JsonValue } from '../../src/a2ui/protocol';

const CASES = join(import.meta.dir, 'cases');

interface Suite {
  schema?: string;
  catalog?: string;
  tests: { description: string; valid: boolean; data: JsonValue }[];
}

function readJson(file: string): JsonValue {
  return JSON.parse(readFileSync(join(CASES, file), 'utf8')) as JsonValue;
}

function documentNamed(name: string): JsonObject {
  const doc = PROTOCOL_DOCUMENTS.find((d) => typeof d.$id === 'string' && d.$id.endsWith(`/${name}`));
  if (doc === undefined) throw new Error(`missing schema ${name}`);
  return doc;
}

function catalogFor(suite: Suite): JsonObject {
  if (suite.catalog === undefined) return BASIC_CATALOG;
  const name = suite.catalog.split('/').pop() ?? suite.catalog;
  const loaded = readJson(name);
  if (!isJsonObject(loaded)) throw new Error('catalog is not an object');
  return loaded;
}

const suites = readdirSync(CASES).filter(
  (f) => f.endsWith('.json') && f !== 'testing_catalog.json' && f !== 'contact_form_example_test.json',
);

describe('A2UI v1.0 schema conformance', () => {
  for (const file of suites) {
    const suite = readJson(file) as unknown as Suite;
    const catalog = catalogFor(suite);
    const registry = createSchemaRegistry([...PROTOCOL_DOCUMENTS, catalog]);
    const document = documentNamed(suite.schema ?? 'agent_to_renderer.json');
    for (const testCase of suite.tests) {
      test(`${file}: ${testCase.description}`, () => {
        const issues = validateJson(document, testCase.data, { registry, document, catalog });
        expect({ valid: issues.length === 0, issues: testCase.valid ? issues : [] }).toEqual({ valid: testCase.valid, issues: [] });
      });
    }
  }
});
