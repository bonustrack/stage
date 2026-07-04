import { describe, expect, test } from 'bun:test';
import { pollQuestionBlocks, type PollQuestionInput } from '../views/chat/pollCardModel';

function votesFor(...sizes: number[]): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  sizes.forEach((size, i) => {
    m.set(i, new Set(Array.from({ length: size }, (_v, n) => `voter-${n}`)));
  });
  return m;
}

const SHIP_IT: PollQuestionInput = {
  question: 'Ship it?',
  options: [{ label: 'Yes' }, { label: 'No' }],
};

describe('pollQuestionBlocks', () => {
  test('computes percentages, stats and total label from vote sets', () => {
    const blocks = pollQuestionBlocks([SHIP_IT], new Map([[0, votesFor(3, 1)]]), undefined);
    const block = blocks[0];
    expect(block).toBeDefined();
    expect(block?.totalLabel).toBe('4 votes');
    expect(block?.options).toEqual([
      { label: 'Yes', stats: '75% · 3', fillPct: 75, selected: false },
      { label: 'No', stats: '25% · 1', fillPct: 25, selected: false },
    ]);
  });

  test('zero total yields 0% for every option', () => {
    const blocks = pollQuestionBlocks([SHIP_IT], undefined, undefined);
    expect(blocks[0]?.totalLabel).toBe('0 votes');
    expect(blocks[0]?.options.map((o) => o.stats)).toEqual(['0% · 0', '0% · 0']);
    expect(blocks[0]?.options.map((o) => o.fillPct)).toEqual([0, 0]);
  });

  test('singular vote label', () => {
    const blocks = pollQuestionBlocks([SHIP_IT], new Map([[0, votesFor(1)]]), undefined);
    expect(blocks[0]?.totalLabel).toBe('1 vote');
  });

  test('rounds percentages', () => {
    const blocks = pollQuestionBlocks([SHIP_IT], new Map([[0, votesFor(1, 2)]]), undefined);
    expect(blocks[0]?.options.map((o) => o.stats)).toEqual(['33% · 1', '67% · 2']);
  });

  test('marks own votes with a check prefix and unselected multi-select with a box', () => {
    const question: PollQuestionInput = {
      question: 'Pick toppings',
      header: 'Lunch poll',
      multiSelect: true,
      options: [{ label: 'Cheese' }, { label: 'Olives' }],
    };
    const blocks = pollQuestionBlocks(
      [question],
      new Map([[0, votesFor(1, 0)]]),
      new Map([[0, new Set([0])]]),
    );
    expect(blocks[0]?.header).toBe('Lunch poll · multi-select');
    expect(blocks[0]?.options).toEqual([
      { label: '✓ Cheese', stats: '100% · 1', fillPct: 100, selected: true },
      { label: '☐ Olives', stats: '0% · 0', fillPct: 0, selected: false },
    ]);
  });

  test('single-select own vote uses check prefix and others stay bare', () => {
    const blocks = pollQuestionBlocks(
      [SHIP_IT],
      new Map([[0, votesFor(1, 1)]]),
      new Map([[0, new Set([1])]]),
    );
    expect(blocks[0]?.options.map((o) => o.label)).toEqual(['Yes', '✓ No']);
    expect(blocks[0]?.options.map((o) => o.selected)).toEqual([false, true]);
  });

  test('open questions get an open header suffix', () => {
    const question: PollQuestionInput = {
      question: 'Anything else?',
      header: 'Feedback',
      open: true,
      options: [],
    };
    const blocks = pollQuestionBlocks([question], undefined, undefined);
    expect(blocks[0]?.header).toBe('Feedback · open');
    expect(blocks[0]?.open).toBe(true);
  });

  test('missing or empty header is hidden', () => {
    const noHeader = pollQuestionBlocks([SHIP_IT], undefined, undefined);
    expect(noHeader[0]?.header).toBeUndefined();
    const emptyHeader = pollQuestionBlocks([{ ...SHIP_IT, header: '' }], undefined, undefined);
    expect(emptyHeader[0]?.header).toBeUndefined();
  });

  test('question text hides for single-question polls and the first of many', () => {
    const second: PollQuestionInput = { question: 'And also?', options: [] };
    const single = pollQuestionBlocks([SHIP_IT], undefined, undefined);
    expect(single[0]?.question).toBeUndefined();
    const multi = pollQuestionBlocks([SHIP_IT, second], undefined, undefined);
    expect(multi[0]?.question).toBeUndefined();
    expect(multi[1]?.question).toBe('And also?');
  });

  test('votes are counted per question index', () => {
    const second: PollQuestionInput = { question: 'And also?', options: [{ label: 'Sure' }] };
    const blocks = pollQuestionBlocks(
      [SHIP_IT, second],
      new Map([[1, votesFor(2)]]),
      undefined,
    );
    expect(blocks[0]?.totalLabel).toBe('0 votes');
    expect(blocks[1]?.totalLabel).toBe('2 votes');
    expect(blocks[1]?.options[0]?.stats).toBe('100% · 2');
  });
});
