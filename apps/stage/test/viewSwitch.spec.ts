import { describe, expect, test } from 'bun:test';
import { boardViewHref, chatsViewHref } from '../components/home/viewSwitch.model';

const PEER = '0x1234567890abcdef1234567890abcdef12345678';
const ROWS = [
  { convId: 'group-1', peerAddress: null },
  { convId: 'dm-1', peerAddress: PEER },
];
const noHandle = (): null => null;
const aliceHandle = (address: string): string | null => (address === PEER ? 'alice.stage.base.eth' : null);

describe('boardViewHref', () => {
  test('opens the plain board when no channel is open', () => {
    expect(boardViewHref('/', ROWS, noHandle)).toBe('/board');
    expect(boardViewHref('/settings', ROWS, noHandle)).toBe('/board');
    expect(boardViewHref('/group/group-1', ROWS, noHandle)).toBe('/board');
  });

  test('keeps an open group channel next to the board', () => {
    expect(boardViewHref('/channel/group-1', ROWS, noHandle))
      .toEqual({ pathname: '/board/[convId]', params: { convId: 'group-1' } });
  });

  test('keeps a group channel open even before its row is cached', () => {
    expect(boardViewHref('/channel/unknown', [], noHandle))
      .toEqual({ pathname: '/board/[convId]', params: { convId: 'unknown' } });
  });

  test('ignores a malformed channel path', () => {
    expect(boardViewHref('/channel/', ROWS, noHandle)).toBe('/board');
    expect(boardViewHref('/channel/group-1/more', ROWS, noHandle)).toBe('/board');
  });

  test('keeps an open dm by its conversation id, from the address or the stage name', () => {
    const dm = { pathname: '/board/[convId]', params: { convId: 'dm-1' } };
    expect(boardViewHref(`/${PEER}`, ROWS, noHandle)).toEqual(dm);
    expect(boardViewHref('/alice', ROWS, aliceHandle)).toEqual(dm);
  });

  test('opens the plain board for a dm that is not in the list', () => {
    expect(boardViewHref('/0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', ROWS, noHandle)).toBe('/board');
  });
});

describe('chatsViewHref', () => {
  test('goes back to the chat list when no channel is open next to the board', () => {
    expect(chatsViewHref('/board', ROWS, noHandle)).toBe('/');
    expect(chatsViewHref('/board/', ROWS, noHandle)).toBe('/');
  });

  test('keeps an open group channel on its chat route', () => {
    expect(chatsViewHref('/board/group-1', ROWS, noHandle))
      .toEqual({ pathname: '/channel/[convId]', params: { convId: 'group-1' } });
  });

  test('keeps an open dm on the peer route, by stage name when known', () => {
    expect(chatsViewHref('/board/dm-1', ROWS, noHandle)).toEqual({ pathname: '/[convId]', params: { convId: PEER } });
    expect(chatsViewHref('/board/dm-1', ROWS, aliceHandle)).toEqual({ pathname: '/[convId]', params: { convId: 'alice' } });
  });

  test('falls back to the channel route for a conversation that is not cached', () => {
    expect(chatsViewHref('/board/unknown', ROWS, noHandle))
      .toEqual({ pathname: '/channel/[convId]', params: { convId: 'unknown' } });
  });
});
