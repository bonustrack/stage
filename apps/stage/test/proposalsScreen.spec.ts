import { describe, expect, test } from 'bun:test';
import { proposalsEmptyLabel, proposalsPositionLabel } from '../views/proposals/proposalsScreen';
import { proposalKindLabel } from '../views/proposals/proposalHeader';

describe('proposalsScreen', () => {
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
