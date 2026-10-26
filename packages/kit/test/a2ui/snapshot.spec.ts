import { describe, expect, test } from 'bun:test';
import { createA2uiClient, type SurfaceNav } from '../../src/a2ui/client';
import { ROOT_SCOPE } from '../../src/a2ui/evaluate';
import { KIT_CATALOG_ID } from '../../src/a2ui/kit-catalog';
import type { JsonObject } from '../../src/a2ui/protocol';
import { a2uiSnapshot } from '../../src/a2ui/snapshot';

const surface = (id: string, rest: JsonObject = {}): JsonObject => ({ version: 'v1.0', createSurface: { surfaceId: id, catalogId: KIT_CATALOG_ID, ...rest } });
const components = (id: string, list: JsonObject[]): JsonObject => ({ version: 'v1.0', updateComponents: { surfaceId: id, components: list } });
const data = (id: string, path: string, value: JsonObject[keyof JsonObject]): JsonObject => ({ version: 'v1.0', updateDataModel: { surfaceId: id, path, value } });

const HOME = [
  surface('home'),
  components('home', [
    { id: 'root', component: 'Column', children: ['title', 'go'] },
    { id: 'title', component: 'Title', text: { '@path': '/title' } },
    { id: 'go-label', component: 'Text', text: 'Details' },
    { id: 'go', component: 'Button', child: 'go-label', action: { functionCall: { '@call': 'openSurface', args: { surfaceId: 'details' } } } },
  ]),
  data('home', '/title', 'Hello'),
];

describe('A2UI snapshot', () => {
  test('compacts a message log into one createSurface per rendered surface', () => {
    const snapshot = a2uiSnapshot([...HOME, data('home', '/title', 'Hi again'), surface('empty')]);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.surfaceIds).toEqual(['home']);
    const replay = createA2uiClient();
    for (const message of snapshot.messages) replay.receive(message as unknown as JsonObject);
    expect(replay.resolve('home', { '@path': '/title' }, ROOT_SCOPE)).toBe('Hi again');
    expect(replay.surface('home')?.components.size).toBe(4);
    expect(a2uiSnapshot(snapshot.messages as unknown as JsonObject[]).messages).toEqual(snapshot.messages);
  });

  test('reports invalid messages and renders nothing without a root', () => {
    const snapshot = a2uiSnapshot([surface('home'), components('home', [{ id: 'x', component: 'Nope' }])]);
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.diagnostics.length).toBeGreaterThan(0);
  });
});

describe('Kit catalog functions', () => {
  test('openSurface and closeSurface reach the host on a user gesture only', () => {
    const navs: SurfaceNav[] = [];
    const client = createA2uiClient({ navigate: (nav) => { navs.push(nav); } });
    for (const message of HOME) client.receive(message);
    const go = client.surface('home')?.components.get('go');
    const action = go?.action as JsonObject;
    expect(client.dispatch('home', 'go', action as never, ROOT_SCOPE)).toEqual({ ok: true });
    expect(client.dispatch('home', 'go', { functionCall: { '@call': 'closeSurface' } }, ROOT_SCOPE)).toEqual({ ok: true });
    expect(navs).toEqual([{ kind: 'open', surfaceId: 'details' }, { kind: 'close' }]);
    expect(client.resolve('home', { '@call': 'closeSurface' }, ROOT_SCOPE)).toBeNull();
    expect(navs).toHaveLength(2);
  });

  test('the agent may call the Kit formatting functions, not the basic ones or navigation', () => {
    const sent: JsonObject[] = [];
    const client = createA2uiClient({ send: (message) => { sent.push(message as unknown as JsonObject); } });
    const call = (id: string, catalogId: string, name: string, args: JsonObject = {}): JsonObject => ({
      version: 'v1.0', callRendererFunction: { functionCallId: id, callFunction: { '@call': name, catalogId, args } },
    });
    client.receive(call('kit', KIT_CATALOG_ID, 'formatNumber', { value: 1234.5 }));
    client.receive(call('basic', 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json', 'formatNumber', { value: 1 }));
    client.receive(call('nav', KIT_CATALOG_ID, 'openSurface', { surfaceId: 'x' }));
    const answers = Object.fromEntries(sent.map((m) => {
      const response = m.rendererFunctionResponse as JsonObject;
      return [String(response.functionCallId), response.error === undefined ? 'value' : (response.error as JsonObject).code];
    }));
    expect(answers).toEqual({ kit: 'value', basic: 'INVALID_FUNCTION_CALL', nav: 'INVALID_FUNCTION_CALL' });
  });
});
