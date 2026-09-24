import { describe, expect, test } from 'bun:test';
import { isFileDrag, leaveDragTarget } from '../components/composer/droppedFiles.model';

const connected = (): boolean => true;

describe('dropping files on the composer', () => {
  test('takes drags that carry files and leaves text and link drags alone', () => {
    expect(isFileDrag(['Files'])).toBe(true);
    expect(isFileDrag(['text/uri-list', 'text/html', 'Files'])).toBe(true);
    expect(isFileDrag(['text/plain'])).toBe(false);
    expect(isFileDrag(['text/uri-list', 'text/html'])).toBe(false);
    expect(isFileDrag([])).toBe(false);
    expect(isFileDrag(undefined)).toBe(false);
  });

  test('stays active while the drag moves between nested elements', () => {
    let targets = leaveDragTarget(['composer', 'textarea'], 'composer', connected);
    expect(targets).toEqual(['textarea']);
    targets = leaveDragTarget([...targets, 'button'], 'textarea', connected);
    expect(targets).toEqual(['button']);
  });

  test('ends when the drag leaves the last element it entered', () => {
    expect(leaveDragTarget(['composer'], 'composer', connected)).toEqual([]);
  });

  test('ends with one leave however often the drag entered the element', () => {
    expect(leaveDragTarget(['textarea', 'textarea'], 'textarea', connected)).toEqual([]);
  });

  test('forgets elements removed from the page, which never fire a leave', () => {
    const removed = new Set(['bubble']);
    expect(leaveDragTarget(['bubble', 'list'], 'list', (t) => !removed.has(t))).toEqual([]);
  });
});
