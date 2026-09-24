import { describe, expect, test } from 'bun:test';
import {
  NO_ROUTES, dmIdsByPeer, dmRowId, isImportReplay, routeOf, uniqueByConvId, withRoute,
} from '../src/xmtp/dmRoutes';

describe('routeOf / withRoute', () => {
  test('an unrouted conversation keeps its own id', () => {
    expect(routeOf(NO_ROUTES, 'imported')).toBe('imported');
  });

  test('a replacement DM routes to the row that was already shown', () => {
    const routes = withRoute(NO_ROUTES, 'active', 'imported');
    expect(routeOf(routes, 'active')).toBe('imported');
    expect(routeOf(routes, 'imported')).toBe('imported');
  });

  test('chains collapse onto the original row', () => {
    const routes = withRoute(withRoute(NO_ROUTES, 'b', 'a'), 'c', 'b');
    expect(routes.c).toBe('a');
    expect(routeOf(routes, 'c')).toBe('a');
  });

  test('a reverse route never creates a cycle', () => {
    const routes = withRoute(NO_ROUTES, 'b', 'a');
    expect(withRoute(routes, 'a', 'b')).toBe(routes);
    expect(withRoute(routes, 'a', 'a')).toBe(routes);
  });

  test('a corrupt cyclic map still terminates', () => {
    expect(['a', 'b']).toContain(routeOf({ a: 'b', b: 'a' }, 'a'));
  });
});

describe('dmRowId', () => {
  const known = dmIdsByPeer([
    { convId: 'imported', peerAddress: '0xAlice' },
    { convId: 'group', peerAddress: null },
  ]);

  test('a stitched DM with a new id keeps the row id already shown for that peer', () => {
    expect(dmRowId(NO_ROUTES, 'active', '0xalice', known)).toEqual({
      rowId: 'imported', route: { from: 'active', to: 'imported' },
    });
  });

  test('a stored route wins without a new route', () => {
    const routes = withRoute(NO_ROUTES, 'active', 'imported');
    expect(dmRowId(routes, 'active', '0xalice', new Map())).toEqual({ rowId: 'imported', route: null });
  });

  test('groups and unknown peers keep their own id', () => {
    expect(dmRowId(NO_ROUTES, 'group', null, known)).toEqual({ rowId: 'group', route: null });
    expect(dmRowId(NO_ROUTES, 'bob-dm', '0xbob', known)).toEqual({ rowId: 'bob-dm', route: null });
    expect(dmRowId(NO_ROUTES, 'imported', '0xalice', known)).toEqual({ rowId: 'imported', route: null });
  });
});

describe('uniqueByConvId', () => {
  test('keeps the first row for each id', () => {
    const rows = [{ convId: 'a', n: 1 }, { convId: 'b', n: 2 }, { convId: 'a', n: 3 }];
    expect(uniqueByConvId(rows)).toEqual([{ convId: 'a', n: 1 }, { convId: 'b', n: 2 }]);
  });
});

describe('isImportReplay', () => {
  test('messages at or before the import are replays, later ones are live', () => {
    expect(isImportReplay(100, 200)).toBe(true);
    expect(isImportReplay(200, 200)).toBe(true);
    expect(isImportReplay(201, 200)).toBe(false);
  });

  test('without an import nothing is a replay', () => {
    expect(isImportReplay(100, 0)).toBe(false);
    expect(isImportReplay(0, 200)).toBe(false);
  });
});
