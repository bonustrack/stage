import { describe, expect, mock, test } from 'bun:test';
import { mockAppStorage } from './memoryStorage';

mockAppStorage();
const { provideActiveAccountReader } = await import('../lib/accountSelection');
provideActiveAccountReader(async () => 'acct');
const { deleteForEveryone, ownDeletesReady } = await import('../lib/ownDeletes');

describe('deleteForEveryone', () => {
  test('hides the message on this device before the delete goes out and keeps it hidden once sent', async () => {
    const seen: boolean[] = [];
    await deleteForEveryone('m1', async () => {
      seen.push((await ownDeletesReady()).has('m1'));
    });
    expect(seen).toEqual([true]);
    expect((await ownDeletesReady()).has('m1')).toBe(true);
  });

  test('shows the message again and rethrows when the delete fails to send', async () => {
    const failure = new Error('offline');
    const send = mock(async () => {
      throw failure;
    });
    await expect(deleteForEveryone('m2', send)).rejects.toBe(failure);
    expect(send).toHaveBeenCalledWith('m2');
    expect((await ownDeletesReady()).has('m2')).toBe(false);
  });
});
