import { describe, expect, test } from 'bun:test';
import {
  PICKER_MAX_WIDTH, applyListEdits, hasListEdits, includesKey, listEdits, matchesQuery, pickerAnchorOf, pickerWidth, selectedFirst, toggleKey,
  uniqueKeys,
} from '../components/conversation/SidebarSection.model';

describe('sidebar section draft', () => {
  test('diffs the draft against the saved list, ignoring case', () => {
    const none = listEdits(['Bug', 'Urgent'], ['urgent', 'bug']);
    expect(none).toEqual({ added: [], removed: [] });
    expect(hasListEdits(none)).toBe(false);
    const edits = listEdits(['Bug', 'Urgent'], ['Bug', 'Design']);
    expect(edits).toEqual({ added: ['Design'], removed: ['Urgent'] });
    expect(hasListEdits(edits)).toBe(true);
    expect(hasListEdits(listEdits([], ['Bug']))).toBe(true);
    expect(hasListEdits(listEdits(['Bug'], []))).toBe(true);
  });

  test('toggles keys case-insensitively and keeps the order', () => {
    expect(toggleKey(['Bug', 'Design'], 'bug')).toEqual(['Design']);
    expect(toggleKey(['Bug'], 'Design')).toEqual(['Bug', 'Design']);
    expect(toggleKey(['Work'], 'Ops', true)).toEqual(['Ops']);
    expect(toggleKey(['Work'], 'work', true)).toEqual([]);
    expect(includesKey(['0xAbC'], '0xabc')).toBe(true);
    expect(uniqueKeys(['Bug', 'bug', 'Design'])).toEqual(['Bug', 'Design']);
  });

  test('applies edits to the latest list without dropping other changes', () => {
    const edits = listEdits(['0xa', '0xb'], ['0xb', '0xc']);
    expect(applyListEdits(['0xa', '0xb', '0xd'], edits)).toEqual(['0xb', '0xd', '0xc']);
    expect(applyListEdits(['0xc'], edits)).toEqual(['0xc']);
  });

  test('lists picked options first and filters by any text', () => {
    expect(selectedFirst(['Alpha', 'Beta', 'Gamma'], ['gamma'])).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(matchesQuery('', 'Alpha')).toBe(true);
    expect(matchesQuery(' ALP ', 'Alpha')).toBe(true);
    expect(matchesQuery('0xab', 'Alice', '0xAB12')).toBe(true);
    expect(matchesQuery('zed', 'Alice', '0xAB12')).toBe(false);
  });
});

describe('pickerAnchorOf', () => {
  const rect = { left: 1000, right: 1280, bottom: 120, width: 280 };

  test('a header on the right opens under it, aligned to its right edge', () => {
    expect(pickerAnchorOf(rect, 1280, 18)).toEqual({ point: { x: 1262, y: 120 }, width: 244 });
  });

  test('a header on the left aligns to its left edge', () => {
    expect(pickerAnchorOf({ left: 0, right: 300, bottom: 80, width: 300 }, 1280, 18)).toEqual({ point: { x: 18, y: 80 }, width: 264 });
  });

  test('wide headers cap the width and native headers have no anchor', () => {
    expect(pickerAnchorOf({ left: 0, right: 1000, bottom: 80, width: 1000 }, 1280, 18)?.width).toBe(PICKER_MAX_WIDTH);
    expect(pickerAnchorOf(undefined, 390, 18)).toBeNull();
    expect(pickerWidth(true, { point: { x: 18, y: 80 }, width: 264 })).toBe(264);
    expect(pickerWidth(false, { point: { x: 18, y: 80 }, width: 264 })).toBeUndefined();
    expect(pickerWidth(true, null)).toBeUndefined();
  });
});
