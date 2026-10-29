import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createA2uiClient, type TransportMetadata } from '../../src/a2ui/client';
import { createCatalogRegistry } from '../../src/a2ui/catalog';
import { KIT_CATALOG, KIT_CATALOG_ID } from '../../src/a2ui/kit-catalog';
import { ROOT_SCOPE } from '../../src/a2ui/evaluate';
import { BASIC_CATALOG, PROTOCOL_DOCUMENTS, PROTOCOL_SCHEMAS } from '../../src/a2ui/schemas';
import { createSchemaRegistry, validateJson } from '../../src/a2ui/json-schema';
import { BASIC_CATALOG_ID, type JsonObject, type RendererMessage } from '../../src/a2ui/protocol';

const CONTACT_FORM = readFileSync(join(import.meta.dir, 'cases', 'contact_form_example.jsonl'), 'utf8');

function harness(extra: Parameters<typeof createA2uiClient>[0] = {}) {
  const sent: { message: RendererMessage; metadata?: TransportMetadata }[] = [];
  const client = createA2uiClient({ send: (message, metadata) => sent.push({ message, metadata }), ...extra });
  return { client, sent };
}

function rendererMessageIssues(message: RendererMessage): unknown[] {
  const registry = createSchemaRegistry([...PROTOCOL_DOCUMENTS, BASIC_CATALOG]);
  const document = PROTOCOL_SCHEMAS.rendererToAgent;
  return validateJson(document, message as unknown as JsonObject, { registry, document, catalog: BASIC_CATALOG });
}

const surface = (id: string, catalogId = BASIC_CATALOG_ID, rest: JsonObject = {}): JsonObject => ({
  version: 'v1.0',
  createSurface: { surfaceId: id, catalogId, ...rest },
});
const components = (id: string, list: JsonObject[]): JsonObject => ({
  version: 'v1.0',
  updateComponents: { surfaceId: id, components: list },
});

describe('A2UI client', () => {
  test('renders the official contact form stream and dispatches its action', () => {
    const { client, sent } = harness();
    const lines = CONTACT_FORM.split('\n').filter((l) => l.trim() !== '');
    client.receive(lines.slice(0, 3).join('\n'));
    expect(sent).toEqual([]);
    const state = client.surface('contact_form_1');
    expect(state?.components.size).toBe(25);
    expect(client.resolve('contact_form_1', { '@path': '/contact/firstName' }, ROOT_SCOPE)).toBe('John');
    const email = state?.components.get('email_field');
    expect(client.checks('contact_form_1', email?.checks as never, ROOT_SCOPE).every((r) => r.valid)).toBe(true);
    client.write('contact_form_1', '/contact/email', 'nope');
    expect(client.checks('contact_form_1', email?.checks as never, ROOT_SCOPE)[1]).toEqual({
      valid: false,
      message: 'Must be a valid email address.',
      severity: 'error',
    });
    const submit = state?.components.get('submit_button');
    expect(client.dispatch('contact_form_1', 'submit_button', submit?.action as never, ROOT_SCOPE)).toEqual({ ok: true });
    const [first] = sent;
    expect(first?.message).toMatchObject({
      version: 'v1.0',
      action: {
        name: 'submitContactForm',
        surfaceId: 'contact_form_1',
        context: { formId: 'contact_form_1', clientTime: 'Mon Feb 2, 2026 3:17 PM', isNewsletterSubscribed: true },
      },
    });
    expect(first === undefined ? ['missing'] : rendererMessageIssues(first.message)).toEqual([]);
    client.receive(lines[3] ?? '');
    expect(client.surface('contact_form_1')).toBeUndefined();
  });

  test('reports integrity and validation errors with spec codes', () => {
    const { client, sent } = harness();
    client.receive(surface('s1'));
    client.receive(surface('s1'));
    client.receive(components('s1', [{ id: 'root', component: 'Text', text: 'hi', variant: 'h1' }]));
    client.receive(components('missing', [{ id: 'root', component: 'Text', text: 'hi' }]));
    expect(sent.map((s) => (s.message as { error: { code: string } }).error.code)).toEqual([
      'INTEGRITY_ERROR',
      'VALIDATION_FAILED',
      'INTEGRITY_ERROR',
    ]);
    expect(sent[1]?.message).toMatchObject({ error: { surfaceId: 's1', path: '/updateComponents/components/0/variant' } });
    for (const { message } of sent) expect(rendererMessageIssues(message)).toEqual([]);
    expect(client.surface('s1')?.components.size).toBe(0);
  });

  test('rejects agent calls to renderer-only functions and runs agent-callable ones', () => {
    const custom: JsonObject = {
      ...KIT_CATALOG,
      $id: 'https://example.test/catalog.json',
      catalogId: 'https://example.test/catalog.json',
      $defs: { anyComponent: (KIT_CATALOG.$defs as JsonObject).anyComponent, anyFunction: { oneOf: [{ $ref: '#/functions/double' }] } },
      functions: {
        double: {
          type: 'object',
          returnType: 'number',
          allowedCallers: 'rendererOrAgent',
          properties: {
            '@call': { const: 'double' },
            args: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
          },
          required: ['@call', 'args'],
        },
      },
    };
    const { client, sent } = harness({
      catalogs: [BASIC_CATALOG, KIT_CATALOG, custom],
      functions: { 'https://example.test/catalog.json': { double: (args) => Number(args.value) * 2 } },
    });
    client.receive({
      version: 'v1.0',
      callRendererFunction: {
        functionCallId: 'a',
        callFunction: { '@call': 'required', catalogId: BASIC_CATALOG_ID, args: { value: 'x' } },
      },
    });
    client.receive({
      version: 'v1.0',
      callRendererFunction: {
        functionCallId: 'b',
        callFunction: { '@call': 'double', catalogId: 'https://example.test/catalog.json', args: { value: 21 } },
      },
    });
    expect(sent.map((s) => s.message)).toEqual([
      {
        version: 'v1.0',
        rendererFunctionResponse: {
          functionCallId: 'a',
          error: {
            code: 'INVALID_FUNCTION_CALL',
            message: "Function 'required' cannot be called by agent (allowedCallers is rendererOnly).",
          },
        },
      },
      { version: 'v1.0', rendererFunctionResponse: { functionCallId: 'b', value: 42 } },
    ]);
  });

  test('routes unknown functions to the agent and resolves the pending value', () => {
    const { client, sent } = harness({ validate: false });
    client.receive(surface('s2'));
    const call = { '@call': 'lookupPrice', args: { sku: 'A1' } };
    expect(client.resolve('s2', call, ROOT_SCOPE)).toBeUndefined();
    expect(client.resolve('s2', call, ROOT_SCOPE)).toBeUndefined();
    expect(sent).toHaveLength(1);
    const request = sent[0]?.message as { callAgentFunction: { functionCallId: string } };
    client.receive({ version: 'v1.0', agentFunctionResponse: { functionCallId: request.callAgentFunction.functionCallId, value: 9.5 } });
    expect(client.resolve('s2', call, ROOT_SCOPE)).toBe(9.5);
  });

  test('evaluates list templates with relative paths and @index', () => {
    const { client } = harness();
    client.receive(surface('s3', BASIC_CATALOG_ID, { dataModel: { items: [{ name: 'Ada' }, { name: 'Linus' }] } }));
    const label = { '@call': 'formatString', args: { value: '#${@index(offset: 1)} ${name} of ${/items/1/name}' } };
    expect(client.resolve('s3', label, { path: '/items/0', indices: [0] })).toBe('#1 Ada of Linus');
    expect(client.resolve('s3', { '@call': '@index' }, ROOT_SCOPE)).toBeNull();
  });

  test('attaches the data model to messages when sendDataModel is set', () => {
    const { client, sent } = harness();
    client.receive(surface('s4', BASIC_CATALOG_ID, { sendDataModel: true, dataModel: { n: 1 } }));
    client.dispatch('s4', 'btn', { event: { name: 'go' } }, ROOT_SCOPE);
    expect(sent[0]?.metadata).toEqual({ a2uiRendererDataModel: { version: 'v1.0', surfaces: { s4: { n: 1 } } } });
  });

  test('blocks user-activation functions outside an action', () => {
    const opened: string[] = [];
    const { client } = harness({ openUrl: (url) => opened.push(url) });
    client.receive(surface('s5'));
    const open = { '@call': 'openUrl', args: { url: 'https://stage.box' } };
    expect(client.resolve('s5', open, ROOT_SCOPE)).toBeNull();
    expect(client.dispatch('s5', 'b', { functionCall: { '@call': 'openUrl', args: { url: 'javascript:alert(1)' } } }, ROOT_SCOPE).ok).toBe(
      false,
    );
    expect(client.dispatch('s5', 'b', { functionCall: open }, ROOT_SCOPE)).toEqual({ ok: true });
    expect(opened).toEqual(['https://stage.box/']);
  });
});

describe('Kit catalog', () => {
  test('is a valid A2UI v1.0 catalog definition', () => {
    const registry = createSchemaRegistry([...PROTOCOL_DOCUMENTS, KIT_CATALOG, BASIC_CATALOG]);
    const document = PROTOCOL_SCHEMAS.catalogDefinition;
    expect(validateJson(document, KIT_CATALOG, { registry, document })).toEqual([]);
  });

  test('accepts Kit extras and still rejects unknown props', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const text = { id: 't', component: 'Text', text: 'Hi', size: 'lg', fontWeight: 'semibold', color: 'secondary' };
    expect(registry.validateComponent(KIT_CATALOG_ID, text, [])).toEqual([]);
    expect(registry.validateComponent(BASIC_CATALOG_ID, text, []).length).toBeGreaterThan(0);
    expect(registry.validateComponent(KIT_CATALOG_ID, { ...text, bogus: 1 }, [])).toEqual([
      { path: '/bogus', message: "Unexpected property 'bogus'." },
    ]);
    const button = { id: 'b', component: 'Button', child: 't', variant: 'soft', color: 'danger', action: { event: { name: 'x' } } };
    expect(registry.validateComponent(KIT_CATALOG_ID, button, [])).toEqual([]);
    expect(registry.validateComponent(KIT_CATALOG_ID, { id: 'i', component: 'Icon', name: 'wallet' }, [])).toEqual([]);
    expect(registry.validateComponent(BASIC_CATALOG_ID, { id: 'i', component: 'Icon', name: 'wallet' }, []).length).toBeGreaterThan(0);
    expect(registry.functionMeta(KIT_CATALOG_ID, 'openUrl')).toEqual({
      returnType: 'void',
      allowedCallers: 'rendererOnly',
      requiresUserActivation: true,
    });
    expect(Object.keys(registry.component(KIT_CATALOG_ID, 'Text')?.properties ?? {}).sort()).toContain('fontWeight');
  });

  test('Kit style props take bindings, sizes take percentages, and Chart is a Kit component', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(valid({ id: 't', component: 'Text', text: 'Late', color: { '@path': 'tone' }, fontWeight: { '@path': '/weight' } })).toEqual([]);
    expect(valid({ id: 'b', component: 'Button', child: 't', color: { '@path': 'tone' }, action: { event: { name: 'x' } } })).toEqual([]);
    const bar = {
      id: 'r',
      component: 'Row',
      children: ['t'],
      width: { '@path': 'share' },
      minWidth: 0,
      padding: { x: 12, top: 4 },
      border: { size: 1, color: 'border' },
    };
    expect(valid(bar)).toEqual([]);
    expect(valid({ ...bar, width: '40%', height: 8 })).toEqual([]);
    expect(valid({ ...bar, width: '40px' }).length).toBeGreaterThan(0);
    expect(valid({ ...bar, padding: { inside: 4 } }).length).toBeGreaterThan(0);
    expect(valid({ id: 'k', component: 'Card', child: 'r', background: '#f7f7f8' })).toEqual([]);
    const chart = {
      id: 'c',
      component: 'Chart',
      data: { '@path': '/trend' },
      series: [{ type: 'bar', dataKey: 'sales', color: 'blue' }],
      xAxis: 'week',
      height: 160,
    };
    expect(valid(chart)).toEqual([]);
    expect(valid({ ...chart, data: [{ week: 'W1', sales: 3 }] })).toEqual([]);
    expect(valid({ ...chart, series: [{ type: 'pie', dataKey: 'sales' }] }).length).toBeGreaterThan(0);
  });

  test('Kit List takes the sortable props and a standard action', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const list = {
      id: 'l',
      component: 'List',
      children: { componentId: 'card', path: 'cards' },
      sortable: true,
      group: 'board',
      listId: { '@path': 'id' },
      itemKey: 'id',
      move: { '@path': '/lastMove' },
      action: { event: { name: 'moveCard', context: { move: { '@path': '/lastMove' } } } },
    };
    expect(registry.validateComponent(KIT_CATALOG_ID, list, [])).toEqual([]);
    expect(registry.validateComponent(KIT_CATALOG_ID, { ...list, move: '/lastMove' }, []).length).toBeGreaterThan(0);
  });

  test('Kit List takes a preview or line indicator and padding, and Kit TextField a submit action', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(valid({ id: 'l', component: 'List', children: ['a'], indicator: 'line', padding: { x: 8 } })).toEqual([]);
    expect(valid({ id: 'l', component: 'List', children: ['a'], indicator: 'shift' }).length).toBeGreaterThan(0);
    const field = { id: 'f', component: 'TextField', label: 'Name', value: { '@path': '/name' } };
    expect(valid({ ...field, action: { event: { name: 'rename', context: { name: { '@path': '/name' } } } } })).toEqual([]);
    expect(registry.validateComponent(BASIC_CATALOG_ID, { ...field, action: { event: { name: 'rename' } } }, []).length).toBeGreaterThan(0);
  });

  test('Kit catalog takes Central icon names, pixel radii, the surface colour, menu swatches, press feedback and side sheets', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(valid({ id: 'i', component: 'Icon', name: 'settingsGear1' })).toEqual([]);
    expect(valid({ id: 'i', component: 'Icon', name: 'chevronRightSmall' })).toEqual([]);
    expect(valid({ id: 'i', component: 'Icon', name: 'noSuchIcon' }).length).toBeGreaterThan(0);
    expect(valid({ id: 'c', component: 'Column', children: ['a'], radius: 14 })).toEqual([]);
    expect(valid({ id: 'c', component: 'Column', children: ['a'], radius: -1 }).length).toBeGreaterThan(0);
    expect(valid({ id: 't', component: 'Text', text: '3', color: 'surface' })).toEqual([]);
    const action = { event: { name: 'setColor' } };
    expect(
      valid({ id: 'm', component: 'DropdownMenu', trigger: 'b', items: [{ label: 'Red', swatch: '#e25507', selected: true, action }] }),
    ).toEqual([]);
    expect(valid({ id: 'r', component: 'Row', children: ['a'], action, feedback: 'highlight' })).toEqual([]);
    expect(valid({ id: 'r', component: 'Row', children: ['a'], action, feedback: 'shake' }).length).toBeGreaterThan(0);
    expect(valid({ id: 'd', component: 'Modal', trigger: 'b', content: 'c', side: 'end' })).toEqual([]);
  });

  test('equals compares two bound values, and not(equals) keeps Save disabled until a field changes', () => {
    const client = createA2uiClient();
    client.receive([surface('editor', KIT_CATALOG_ID, { dataModel: { name: 'Ada', saved: 'Ada' } })]);
    const rules = [
      {
        condition: {
          '@call': 'not',
          args: { value: { '@call': 'equals', args: { value: { '@path': '/name' }, other: { '@path': '/saved' } } } },
        },
        message: 'No changes yet.',
      },
    ];
    expect(client.checks('editor', rules as never, ROOT_SCOPE)[0]?.valid).toBe(false);
    client.write('editor', '/name', 'Grace');
    expect(client.checks('editor', rules as never, ROOT_SCOPE)[0]?.valid).toBe(true);
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const button = { id: 'save', component: 'Button', child: 'l', action: { event: { name: 'save' } }, checks: rules };
    expect(registry.validateComponent(KIT_CATALOG_ID, button, [])).toEqual([]);
  });

  test('Kit CheckBox takes an action, sortable lists a handle, and Text letter spacing and case', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(
      valid({
        id: 'c',
        component: 'CheckBox',
        label: 'In sidebar',
        value: { '@path': 'shown' },
        displayStyle: 'switch',
        action: { event: { name: 'toggle', context: { shown: { '@path': 'shown' } } } },
      }),
    ).toEqual([]);
    expect(valid({ id: 'l', component: 'List', children: { componentId: 'row', path: '/pages' }, sortable: true, handle: 'grip' })).toEqual(
      [],
    );
    expect(valid({ id: 't', component: 'Text', text: 'Panel', letterSpacing: 1, textTransform: 'uppercase' })).toEqual([]);
    expect(valid({ id: 't', component: 'Text', text: 'Panel', textTransform: 'shout' }).length).toBeGreaterThan(0);
    expect(
      valid({
        id: 'm',
        component: 'DropdownMenu',
        trigger: 'row',
        openOn: 'contextMenu',
        items: [{ label: 'Rename', action: { event: { name: 'rename' } } }],
      }),
    ).toEqual([]);
  });

  test('Kit catalog takes per-side borders, opacity, Button loading and selectable Text', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(valid({ id: 'r', component: 'Row', children: ['a'], border: { bottom: { size: 1, color: 'border' } } })).toEqual([]);
    expect(valid({ id: 'r', component: 'Row', children: ['a'], border: { left: 2 } })).toEqual([]);
    expect(valid({ id: 'r', component: 'Row', children: ['a'], border: { middle: 1 } }).length).toBeGreaterThan(0);
    expect(valid({ id: 'r', component: 'Column', children: ['a'], opacity: 0.6 })).toEqual([]);
    expect(valid({ id: 'r', component: 'Column', children: ['a'], opacity: 2 }).length).toBeGreaterThan(0);
    expect(valid({ id: 't', component: 'Text', text: 'x', opacity: 0.5, selectable: true })).toEqual([]);
    expect(
      valid({ id: 'b', component: 'Button', child: 'l', loading: { '@path': '/saving' }, action: { event: { name: 'save' } } }),
    ).toEqual([]);
  });

  test('Kit Row and Column take a standard action', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const action = { event: { name: 'pickTheme', context: { id: { '@path': 'id' } } } };
    expect(registry.validateComponent(KIT_CATALOG_ID, { id: 'c', component: 'Column', children: ['a'], action }, [])).toEqual([]);
    expect(registry.validateComponent(KIT_CATALOG_ID, { id: 'r', component: 'Row', children: ['a'], action }, [])).toEqual([]);
    expect(
      registry.validateComponent(BASIC_CATALOG_ID, { id: 'c', component: 'Column', children: ['a'], action }, []).length,
    ).toBeGreaterThan(0);
  });

  test('Kit DropdownMenu takes a trigger and rows with actions, and Kit Modal a bound open', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    const row = {
      label: 'Delete',
      icon: 'delete',
      danger: true,
      action: { event: { name: 'deleteColumn', context: { id: { '@path': 'id' } } } },
    };
    const menu = { id: 'm', component: 'DropdownMenu', trigger: 'more', align: 'end', items: [row] };
    expect(valid(menu)).toEqual([]);
    expect(valid({ ...menu, items: [{ label: 'Delete' }] }).length).toBeGreaterThan(0);
    expect(valid({ ...menu, items: [{ ...row, bogus: 1 }] }).length).toBeGreaterThan(0);
    expect(valid({ id: 'd', component: 'Modal', trigger: 'open', content: 'body', open: { '@path': '/confirm/open' } })).toEqual([]);
  });

  test('Kit catalog takes card surfaces, hidden labels, title line clamps and bound chart series', () => {
    const registry = createCatalogRegistry([BASIC_CATALOG, KIT_CATALOG]);
    const valid = (component: JsonObject) => registry.validateComponent(KIT_CATALOG_ID, component, []);
    expect(valid({ id: 'k', component: 'Card', child: 'r', surface: 'surface' })).toEqual([]);
    expect(valid({ id: 'f', component: 'TextField', label: 'Search', hideLabel: true, pill: true, value: { '@path': '/q' } })).toEqual([]);
    expect(valid({ id: 'h', component: 'Title', text: 'Project', maxLines: 3 })).toEqual([]);
    const chart = { id: 'c', component: 'Chart', data: { '@path': '/trend' }, xAxis: 'week' };
    expect(valid({ ...chart, series: { '@path': '/series' } })).toEqual([]);
    expect(
      valid({ ...chart, series: [{ type: 'line', dataKey: { '@path': '/metric/key' }, label: { '@path': '/metric/label' } }] }),
    ).toEqual([]);
  });
});
