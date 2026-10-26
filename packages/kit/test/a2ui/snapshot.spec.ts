import { describe, expect, test } from 'bun:test';
import { createA2uiClient } from '../../src/a2ui/client';
import { ROOT_SCOPE } from '../../src/a2ui/evaluate';
import type { SurfaceNav } from '../../src/a2ui/functions.kit';
import { KIT_CATALOG_ID } from '../../src/a2ui/kit-catalog';
import type { JsonObject } from '../../src/a2ui/protocol';
import { a2uiSnapshot, dataModelUpdates } from '../../src/a2ui/snapshot';

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

  test('exports the live data model so local edits survive a reply', () => {
    const client = createA2uiClient();
    for (const message of HOME) client.receive(message);
    client.write('home', '/title', 'Edited');
    const snapshot = a2uiSnapshot([...HOME, ...dataModelUpdates(client)]);
    const replay = createA2uiClient();
    for (const message of snapshot.messages) replay.receive(message as unknown as JsonObject);
    expect(replay.resolve('home', { '@path': '/title' }, ROOT_SCOPE)).toBe('Edited');
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

  test('agentFunction validates in a component and becomes a callAgentFunction that the answer settles', () => {
    const sent: JsonObject[] = [];
    const client = createA2uiClient({ send: (message) => { sent.push(message as unknown as JsonObject); } });
    const call = { '@call': 'agentFunction', args: { name: 'quote', args: { coin: 'BTC' } } };
    client.receive(surface('q', { components: [{ id: 'root', component: 'Text', text: call }] }));
    expect(client.surface('q')?.components.size).toBe(1);
    expect(client.resolve('q', call, ROOT_SCOPE)).toBeUndefined();
    const out = sent.find((m) => m.callAgentFunction !== undefined)?.callAgentFunction as JsonObject | undefined;
    expect(out?.callFunction).toEqual({ ...call, catalogId: KIT_CATALOG_ID });
    client.receive({ version: 'v1.0', agentFunctionResponse: { functionCallId: out?.functionCallId ?? '', value: '$64,210' } });
    expect(client.resolve('q', call, ROOT_SCOPE)).toBe('$64,210');
  });
});
