import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { A2uiClient } from '../../src/a2ui/client';
import { BASIC_CATALOG_ID } from '../../src/a2ui/protocol';
import { BASIC_CATALOG } from '../../src/a2ui/schemas';
import { useA2uiClient, type A2uiSessionOptions } from '../../src/react-native/a2ui-session';

function clientFor(messages: readonly unknown[], options: A2uiSessionOptions): A2uiClient {
  const box: { client?: A2uiClient } = {};
  function Probe(): null {
    box.client = useA2uiClient(messages, options);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  if (box.client === undefined) throw new Error('the hook returned no client');
  return box.client;
}

const createSurface = { version: 'v1.0', createSurface: { surfaceId: 'main', catalogId: BASIC_CATALOG_ID } };

test('useA2uiClient forwards every client option and applies the messages', () => {
  const diagnostics: string[] = [];
  const client = clientFor([createSurface, { version: 'v1.0', updateComponents: { surfaceId: 'main', components: [{ id: 'root' }] } }], {
    catalogs: [BASIC_CATALOG],
    validate: false,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.code),
  });
  expect(client.capabilities()['v1.0']?.supportedCatalogIds).toEqual([BASIC_CATALOG_ID]);
  expect(client.surface('main')?.components.has('root')).toBe(true);
  expect(diagnostics).toEqual([]);
});

test('useA2uiClient hands the session client to send', () => {
  const sent: A2uiClient[] = [];
  const client = clientFor([createSurface], { catalogs: [BASIC_CATALOG], send: (_message, from) => sent.push(from) });
  client.dispatch('main', 'root', { event: { name: 'tap' } }, { path: '/', indices: [] });
  expect(sent).toEqual([client]);
});
