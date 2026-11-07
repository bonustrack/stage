import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROUTE_SEGMENTS } from '@stage-labs/client/routing/routes';
import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';

const APP_DIR = join(import.meta.dir, '..', 'app');

function routeFiles(): string[] {
  return readdirSync(APP_DIR, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));
}

function urlSegments(file: string): string[] {
  return file
    .replace(/\.tsx?$/, '')
    .split(/[\\/]/)
    .filter((part) => !/^\(.*\)$/.test(part) && part !== 'index');
}

function isRouteFile(file: string): boolean {
  const name = file.split(/[\\/]/).at(-1) ?? '';
  return !name.startsWith('_') && !name.startsWith('+');
}

function rootSegments(): { fixed: Set<string>; dynamic: Set<string> } {
  const fixed = new Set<string>();
  const dynamic = new Set<string>();
  for (const file of routeFiles().filter(isRouteFile)) {
    const root = urlSegments(file)[0];
    if (root === undefined) continue;
    if (root.startsWith('[')) dynamic.add(root);
    else fixed.add(root);
  }
  return { fixed, dynamic };
}

describe('the app router and the client route list', () => {
  test('every top-level route folder or file of the app is in the route list, and nothing else', () => {
    expect([...rootSegments().fixed].sort()).toEqual([...APP_ROUTE_SEGMENTS].sort());
  });

  test('the only dynamic top-level route is the peer conversation, so a handle can never name an app route', () => {
    expect([...rootSegments().dynamic]).toEqual(['[convId]']);
    for (const segment of rootSegments().fixed) expect(isPeerHandleSegment(segment)).toBe(false);
  });
});
