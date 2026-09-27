import { describe, expect, test } from 'bun:test';
import {
  channelRefLabel, channelRefToken, channelRefsOf, hasChannelRef, splitChannelRefs, withChannelLabels,
} from '../src/xmtp/channelRefs';
import { humanizeMentions } from '../src/xmtp/humanize';

const CONV = '9f2c4e1ab37d4c0e8f1a2b3c4d5e6f70';
const REF = `[#Design team](https://stage.box/#/channel/${CONV})`;

describe('channelRefToken', () => {
  test('links the label to the stage.box channel share url', () => {
    expect(channelRefToken(CONV, 'Design team')).toBe(REF);
  });

  test('keeps link syntax and a leading hash out of the label', () => {
    expect(channelRefLabel('# Ops [eu] (night)\nshift')).toBe('Ops eu night shift');
    expect(channelRefLabel(' [] ')).toBe('channel');
  });

  test('round trips through channelRefsOf', () => {
    const token = channelRefToken(CONV, 'A (b) [c]');
    expect(channelRefsOf(`see ${token} now`)).toEqual([{ index: 4, wire: token, label: 'A b c', convId: CONV }]);
  });
});

describe('channelRefsOf', () => {
  test('finds every ref with its position', () => {
    const text = `${REF} and [#Ops](https://stage.box/#/channel/abc)`;
    expect(channelRefsOf(text).map(r => [r.index, r.label, r.convId])).toEqual([
      [0, 'Design team', CONV],
      [REF.length + 5, 'Ops', 'abc'],
    ]);
  });

  test('ignores links that are not stage channel refs', () => {
    expect(hasChannelRef('[#Ops](https://example.com/#/channel/abc)')).toBe(false);
    expect(hasChannelRef('[Ops](https://stage.box/#/channel/abc)')).toBe(false);
    expect(hasChannelRef(`https://stage.box/#/channel/${CONV}`)).toBe(false);
    expect(hasChannelRef(`hi ${REF}`)).toBe(true);
  });
});

describe('splitChannelRefs', () => {
  test('splits text around refs', () => {
    expect(splitChannelRefs(`join ${REF}!`)).toEqual([
      { type: 'text', text: 'join ' },
      { type: 'channel', convId: CONV, label: 'Design team' },
      { type: 'text', text: '!' },
    ]);
  });

  test('returns plain text untouched', () => {
    expect(splitChannelRefs('no refs')).toEqual([{ type: 'text', text: 'no refs' }]);
  });
});

describe('withChannelLabels', () => {
  test('replaces each ref with its hash label', () => {
    expect(withChannelLabels(`${REF}, ${REF}`)).toBe('#Design team, #Design team');
  });

  test('shows channel refs as hash labels in previews', () => {
    expect(humanizeMentions(`join ${REF}`)).toBe('join #Design team');
  });
});
