import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { selectAccount } from './activeAccount';
import { mockAppStorage } from './memoryStorage';

const { values } = mockAppStorage();
const { orderSetting, syncedSetting } = await import('../lib/sync/setting');
const { stampLocal, takeIfNewer } = await import('../lib/sync/clock');
const { nextStamp } = await import('../lib/syncedSettings.model');

interface Note {
  text: string;
  at: number;
}

const noteSchema = z.object({ text: z.string(), at: z.number() });

function noteSetting(key: string, restore?: (local: Note, stored: Note) => Note) {
  return syncedSetting<Note>(
    { key, default: { text: '', at: 0 }, schema: noteSchema, perAccount: true, ...(restore ? { restore } : {}) },
    { receive: (current, incoming) => (incoming.at > current.at ? incoming : current) },
  );
}

function announced<T>(setting: { sync: { onLocalChange: (cb: (change: { accountId: string; state: T }) => void) => () => void } }) {
  const changes: { accountId: string; state: T }[] = [];
  setting.sync.onLocalChange((change) => changes.push(change));
  return changes;
}

describe('synced settings', () => {
  test('an edit writes the value, runs its side effect, then announces it for the loaded account', async () => {
    selectAccount('alice');
    const note = noteSetting('note.edit.');
    const changes = announced(note);
    const effects: string[] = [];
    note.edit((current) => ({ ...current, text: 'early' }));
    expect(note.prefs.get().text).toBe('');
    await note.prefs.load();
    note.edit(
      (current) => ({ text: 'hello', at: current.at + 1 }),
      (accountId, previous, next) => effects.push(`${accountId}:${previous.text}>${next.text}`),
    );
    note.edit((current) => current);
    expect(effects).toEqual(['alice:>hello']);
    expect(changes).toEqual([{ accountId: 'alice', state: { text: 'hello', at: 1 } }]);
    expect(JSON.parse(values.get('note.edit.alice') ?? 'null')).toEqual({ text: 'hello', at: 1 });
  });

  test('a setting that restores local state keeps an edit made before it loads, announced only once loaded', async () => {
    selectAccount('bob');
    const note = noteSetting('note.restore.', (local) => local);
    const changes = announced(note);
    note.edit(() => ({ text: 'typed early', at: 5 }));
    expect(note.prefs.get().text).toBe('typed early');
    expect(changes).toEqual([]);
  });

  test('a stored edit reloads first and announces only when asked', async () => {
    selectAccount('carol');
    values.set('note.stored.carol', JSON.stringify({ text: 'saved', at: 3 }));
    const note = noteSetting('note.stored.');
    const changes = announced(note);
    await note.editStored((current) => ({ ...current, text: `${current.text}!` }), false);
    await note.editStored((current) => ({ text: current.text, at: current.at + 1 }));
    expect(changes).toEqual([{ accountId: 'carol', state: { text: 'saved!', at: 4 } }]);
  });

  test('an order setting snapshots nothing until an order is set and takes the newest remote order', async () => {
    selectAccount('dave');
    const order = orderSetting({ key: 'order.test.', default: [], schema: z.array(z.string()), perAccount: true });
    expect(await order.sync.load('dave')).toBeNull();
    await order.sync.applyRemote('dave', ['b', 'a']);
    expect(await order.sync.load('dave')).toEqual(['b', 'a']);
  });
});

describe('sync stamps', () => {
  test('a local stamp never goes back in time or repeats', () => {
    expect(nextStamp(undefined, 100)).toBe(100);
    expect(nextStamp(100, 100)).toBe(101);
    expect(nextStamp(500, 100)).toBe(501);
    const first = stampLocal('stamp.test');
    const second = stampLocal('stamp.test');
    expect(second).toBeGreaterThan(first);
    expect(takeIfNewer('stamp.test', second)).toBe(false);
    expect(takeIfNewer('stamp.test', second + 1)).toBe(true);
  });
});
