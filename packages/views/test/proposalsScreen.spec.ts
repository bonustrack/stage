import { describe, expect, test } from 'bun:test';
import {
  proposalsEmptyLabel,
  proposalsHeaderNode,
  proposalsPositionLabel,
} from '../src/proposals/proposalsScreen';
import { proposalKindLabel } from '../src/proposals/proposalHeader';

describe('proposalsScreen', () => {
  test('header node titles the screen Pending requests with injected colors', () => {
    const node = proposalsHeaderNode({
      backColor: '#111',
      surface: '#fff',
      borderColor: '#eee',
      safeTop: 20,
    });
    const json = JSON.stringify(node);
    expect(json).toContain('"Pending requests"');
    expect(json).toContain('"#111"');
    expect(json).toContain('"#fff"');
    expect(json).toContain('"#eee"');
  });

  test('empty label switches between loading and empty copy', () => {
    expect(proposalsEmptyLabel(true)).toBe('Loading requests…');
    expect(proposalsEmptyLabel(false)).toBe('No pending requests');
  });

  test('position label renders X of Y', () => {
    expect(proposalsPositionLabel(2, 5)).toBe('2 of 5');
  });
});

describe('proposalKindLabel', () => {
  test('maps every request kind to its display label', () => {
    expect(proposalKindLabel('poll')).toBe('Poll');
    expect(proposalKindLabel('payment')).toBe('Payment request');
    expect(proposalKindLabel('signing')).toBe('Signing request');
    expect(proposalKindLabel('message')).toBe('Message request');
  });
});
