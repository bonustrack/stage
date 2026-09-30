import { describe, expect, test } from 'bun:test';
import { attachmentCellWidths, validSize } from '../components/bubble/imageBox.model';

describe('attachment squares', () => {
  test('a single attachment fills the full square', () => {
    expect(attachmentCellWidths(['image'])).toEqual(['100%']);
    expect(attachmentCellWidths(['file'])).toEqual(['100%']);
  });

  test('several attachments share a grid of equal half-width squares', () => {
    expect(attachmentCellWidths(['image', 'image', 'image'])).toEqual(['50%', '50%', '50%']);
    expect(attachmentCellWidths(['image', 'video', 'file'])).toEqual(['50%', '50%', '100%']);
  });

  test('audio keeps a full-width row and never counts as a square', () => {
    expect(attachmentCellWidths(['audio', 'image'])).toEqual(['100%', '100%']);
    expect(attachmentCellWidths(['image', 'audio', 'image'])).toEqual(['50%', '100%', '50%']);
    expect(attachmentCellWidths([])).toEqual([]);
  });

  test('files keep full-width rows and never count as squares', () => {
    expect(attachmentCellWidths(['file', 'file'])).toEqual(['100%', '100%']);
    expect(attachmentCellWidths(['file', 'image'])).toEqual(['100%', '100%']);
    expect(attachmentCellWidths(['audio', 'file', 'video'])).toEqual(['100%', '100%', '100%']);
    expect(attachmentCellWidths(['image', 'file', 'image'])).toEqual(['50%', '100%', '50%']);
  });

  test('accepts only a positive measured size', () => {
    expect(validSize({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 });
    expect(validSize({ width: 0, height: 480 })).toBeUndefined();
    expect(validSize({ width: 640, height: 0 })).toBeUndefined();
    expect(validSize({ width: 640 })).toBeUndefined();
    expect(validSize(undefined)).toBeUndefined();
  });
});
