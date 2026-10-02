import { describe, expect, test } from 'bun:test';
import { channelRefToken } from '@stage-labs/client/xmtp/channelRefs';
import {
  channelCandidatesOf, channelQuery, matchChannels, type ChannelCandidate,
} from '../components/composer/channels.model';
import {
  activeSuggestIndex, applyDisplayEdit, insertToken, piecesOf, toDisplay,
} from '../components/composer/mentions.model';

const ALICE = `0x${'a'.repeat(40)}`;
const labelOf = (address: string): string => (address === ALICE ? '@alice' : '@someone');
const DESIGN = channelRefToken('c0ffee01', 'Design team');
const OPS = channelRefToken('c0ffee02', 'Ops');

function candidate(convId: string, name: string): ChannelCandidate {
  return { convId, name, avatarUri: null, avatarAddress: convId };
}

describe('composer channel display', () => {
  test('shows a channel ref as its hash label next to a mention', () => {
    expect(toDisplay(`see ${DESIGN} with @${ALICE} `, labelOf)).toBe('see #Design team with @alice ');
  });

  test('keeps the ref when typing after it', () => {
    const r = applyDisplayEdit(piecesOf(`${DESIGN} `, labelOf), '#Design team x', labelOf, { start: 14, end: 14 });
    expect(r.wire).toBe(`${DESIGN} x`);
  });

  test('shows a channel named after an address once, as a single ref', () => {
    const named = channelRefToken('c0ffee03', `@${ALICE} fans`);
    const pieces = piecesOf(`${named} hi`, labelOf);
    expect(pieces.map(p => p.display)).toEqual([`#@${ALICE} fans`, ' hi']);
    expect(pieces[0]?.wire).toBe(named);
  });

  test('turns the ref into its text when typing inside the label', () => {
    const r = applyDisplayEdit(piecesOf(`${DESIGN} `, labelOf), '#Desxign team ', labelOf, { start: 5, end: 5 });
    expect(r.wire).toBe('#Desxign team ');
  });
});

describe('composer channel insert', () => {
  test('sends the ref and puts the caret after its label', () => {
    const r = insertToken(piecesOf('join #des now', labelOf), { start: 5, end: 9 }, DESIGN, labelOf);
    expect(r.wire).toBe(`join ${DESIGN}  now`);
    expect(r.caret).toBe('join #Design team '.length);
  });

  test('keeps an earlier mention and ref intact', () => {
    const wire = `@${ALICE} ${OPS} #d`;
    const r = insertToken(piecesOf(wire, labelOf), { start: 12, end: 14 }, DESIGN, labelOf);
    expect(r.wire).toBe(`@${ALICE} ${OPS} ${DESIGN} `);
    expect(r.caret).toBe('@alice #Ops #Design team '.length);
  });
});

describe('composer channel query', () => {
  test('opens on a hash at the start of a word', () => {
    expect(channelQuery(piecesOf('#', labelOf), 1)).toEqual({ text: '', range: { start: 0, end: 1 } });
    expect(channelQuery(piecesOf('hi #de', labelOf), 6)).toEqual({ text: 'de', range: { start: 3, end: 6 } });
  });

  test('stays closed for a hash inside a word or before the caret moves on', () => {
    expect(channelQuery(piecesOf('C#', labelOf), 2)).toBeNull();
    expect(channelQuery(piecesOf('#de x', labelOf), 5)).toBeNull();
    expect(channelQuery(piecesOf('no hash', labelOf), 7)).toBeNull();
  });

  test('stays closed inside an inserted ref', () => {
    expect(channelQuery(piecesOf(OPS, labelOf), 4)).toBeNull();
  });
});

describe('composer channel candidates', () => {
  test('lists titled groups other than the current one', () => {
    const rows = [
      { convId: 'here', title: 'Here' },
      { convId: 'dm', title: 'Alice', peerAddress: ALICE },
      { convId: 'untitled', title: '  ' },
      { convId: 'img', title: ' Design ', avatarUri: 'https://x/y.png', avatarAddress: 'seed' },
      { convId: 'seed', title: 'Ops', avatarUri: null, avatarAddress: 'stamp' },
    ];
    expect(channelCandidatesOf(rows, 'here')).toEqual([
      { convId: 'img', name: 'Design', avatarUri: 'https://x/y.png', avatarAddress: null },
      { convId: 'seed', name: 'Ops', avatarUri: null, avatarAddress: 'stamp' },
    ]);
    expect(channelCandidatesOf(null, 'here')).toEqual([]);
  });

  test('ranks a name prefix, then a word prefix, then any match', () => {
    const list = [candidate('2', 'devops'), candidate('1', 'Shared ops'), candidate('3', 'Ops team'), candidate('4', 'Design')];
    expect(matchChannels(list, 'OPS').map(c => c.convId)).toEqual(['3', '1', '2']);
    expect(matchChannels(list, '').map(c => c.convId)).toEqual(['2', '1', '3', '4']);
  });

  test('shows at most six channels', () => {
    const list = Array.from({ length: 9 }, (_, i) => candidate(`${i}`, `team ${i}`));
    expect(matchChannels(list, 'team')).toHaveLength(6);
  });

  test('keeps the highlight on the same channel while the list changes', () => {
    const list = [candidate('1', 'a'), candidate('2', 'b')];
    const byConvId = (c: ChannelCandidate): string => c.convId;
    expect(activeSuggestIndex(list, '0:', { key: '0:', id: '2' }, byConvId)).toBe(1);
    expect(activeSuggestIndex(list, '0:b', { key: '0:', id: '2' }, byConvId)).toBe(0);
    expect(activeSuggestIndex(list, '0:', { key: '0:', id: 'gone' }, byConvId)).toBe(0);
  });
});
