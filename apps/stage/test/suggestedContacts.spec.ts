import { describe, expect, test } from 'bun:test';
import { SUGGESTED_SUBTITLE, suggestedContacts, suggestedSubtitle } from '../components/contacts/SuggestedContacts.model';

const ANN = '0xAAaa000000000000000000000000000000000001';
const BOB = '0xBBbb000000000000000000000000000000000002';
const POOL = [ANN, BOB];

describe('suggestedContacts', () => {
  test('offers every suggestion when none is known', () => {
    expect(suggestedContacts([], null, POOL)).toEqual(POOL);
  });
  test('hides suggestions already chatted with, case-insensitively', () => {
    expect(suggestedContacts([ANN.toLowerCase()], null, POOL)).toEqual([BOB]);
  });
  test('never suggests the active account itself', () => {
    expect(suggestedContacts([], BOB.toUpperCase(), POOL)).toEqual([ANN]);
  });
  test('shows the profile description when there is one, else the generic label', () => {
    expect(suggestedSubtitle('Onboarding assistant for Stage users.')).toBe('Onboarding assistant for Stage users.');
    expect(suggestedSubtitle('   ')).toBe(SUGGESTED_SUBTITLE);
    expect(suggestedSubtitle(undefined)).toBe(SUGGESTED_SUBTITLE);
  });
});
