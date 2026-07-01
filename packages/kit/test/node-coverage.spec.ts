import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { NODE_TYPE_NAMES, isKnownNodeType } from '../src/kit/node-registry';

const SRC = join(import.meta.dir, '..', 'src');

function readAll(dir: string, match: (name: string) => boolean): string {
  return readdirSync(dir)
    .filter(match)
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

const rnSources = readAll(
  join(SRC, 'react-native'),
  (n) => n.startsWith('kit-render'),
);

const vueSources = readAll(
  join(SRC, 'vue'),
  (n) => n.startsWith('Kit') || n === 'kit-node-props.ts',
);

function referencesType(source: string, type: string): boolean {
  return source.includes(`'${type}'`) || source.includes(`"${type}"`);
}

const KNOWN_RN_GAPS = ['ListViewItem'];
const KNOWN_VUE_GAPS = ['VoiceRecorder'];

describe('node type coverage parity', () => {
  test('react-native renderer references every known node type (baselined gaps)', () => {
    const missing = NODE_TYPE_NAMES.filter((t) => !referencesType(rnSources, t));
    expect(missing).toEqual(KNOWN_RN_GAPS);
  });

  test('vue renderer references every known node type (baselined gaps)', () => {
    const missing = NODE_TYPE_NAMES.filter((t) => !referencesType(vueSources, t));
    expect(missing).toEqual(KNOWN_VUE_GAPS);
  });

  test('isKnownNodeType accepts registry names and rejects others', () => {
    for (const t of NODE_TYPE_NAMES) expect(isKnownNodeType(t)).toBe(true);
    expect(isKnownNodeType('NotANode')).toBe(false);
    expect(isKnownNodeType('')).toBe(false);
  });

  test('registry has the expected cardinality', () => {
    expect(NODE_TYPE_NAMES.length).toBe(45);
    expect(new Set(NODE_TYPE_NAMES).size).toBe(45);
  });
});
