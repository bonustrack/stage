import { describe, expect, test } from 'bun:test';
import { withNestedReactions } from '../lib/nestedReactions.model';

interface Msg { id: string; ns: number; reactions: Msg[] }

const msg = (id: string, ns: number, reactions: Msg[] = []): Msg => ({ id, ns, reactions });
const ids = (list: Msg[]): string[] => list.map((m) => m.id);
const expand = (list: Msg[]): Msg[] => withNestedReactions(list, (m) => m.reactions, (m) => m.ns);

describe('nested reactions in a history page', () => {
  test('lists every reaction a message carries, including removals', () => {
    const page = [
      msg('m2', 20, [msg('add-m2', 25)]),
      msg('m1', 10, [msg('add-m1', 30), msg('remove-m1', 40)]),
    ];
    expect(ids(expand(page)).sort()).toEqual(['add-m1', 'add-m2', 'm1', 'm2', 'remove-m1']);
  });

  test('orders reactions and messages newest first across the page', () => {
    const page = [
      msg('m3', 30),
      msg('m2', 20, [msg('r25', 25), msg('r45', 45)]),
      msg('m1', 10, [msg('r35', 35)]),
    ];
    expect(ids(expand(page))).toEqual(['r45', 'r35', 'm3', 'r25', 'm2', 'm1']);
  });

  test('keeps a reaction stamped before its message ahead of it, so the page still ends on its oldest message', () => {
    const page = [msg('m2', 20), msg('m1', 10, [msg('early', 5)])];
    expect(ids(expand(page))).toEqual(['m2', 'early', 'm1']);
  });
});
