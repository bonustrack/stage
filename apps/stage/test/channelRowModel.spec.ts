import { describe, expect, test } from 'bun:test';
import { FONT_SIZE } from '@stage-labs/kit/tokens';
import { channelRowModel } from '../components/ChannelRow.model';

describe('channelRowModel', () => {
  test('minimal domain maps to empty-preview params', () => {
    const p = channelRowModel({ title: 'Alice', timestampLabel: '' });
    expect(p).toEqual({
      title: 'Alice',
      titleSegments: undefined,
      preview: '',
      showPreview: true,
      previewPrefix: undefined,
      timestamp: '',
      timestampSize: '3xs',
      pinned: undefined,
    });
  });

  test('draft wins over preview and adds Draft: prefix', () => {
    const p = channelRowModel({ title: 'Alice', lastPreview: 'hello', draftText: '  wip  ', timestampLabel: '9:15 AM' });
    expect(p.preview).toBe('wip');
    expect(p.previewPrefix).toBe('Draft:');
    expect(p.timestamp).toBe('9:15 AM');
  });

  test('a draft sharing a channel shows the channel name, not its link', () => {
    const p = channelRowModel({
      title: 'Alice',
      timestampLabel: '',
      draftText: 'see [#Ops night shift](https://stage.box/#/channel/2e793fb8087052ca59109ca900e53de9) ',
    });
    expect(p.preview).toBe('see #Ops night shift');
  });

  test('the time uses the kit 3xs text size, smaller than the md title', () => {
    const p = channelRowModel({ title: 'Alice', timestampLabel: '1:38 AM' });
    expect(p.timestampSize).toBe('3xs');
    expect(FONT_SIZE[p.timestampSize]).toBeLessThan(FONT_SIZE.md);
  });

  test('preview visibility is independent of title, time, pins and draft content', () => {
    const data = { title: 'Alice', timestampLabel: '9:15 AM', lastPreview: 'hello', draftText: 'wip', pinned: true };
    expect(channelRowModel({ ...data, showPreview: false })).toEqual({ ...channelRowModel(data), showPreview: false });
    expect(channelRowModel({ ...data, showPreview: true }).showPreview).toBe(true);
  });

  test('preview falls back lastPreview -> subtitle -> empty', () => {
    const base = { title: 't', timestampLabel: '' };
    expect(channelRowModel({ ...base, lastPreview: 'p', subtitle: 's' }).preview).toBe('p');
    expect(channelRowModel({ ...base, lastPreview: '', subtitle: 's' }).preview).toBe('s');
    expect(channelRowModel(base).preview).toBe('');
  });

  test('keeps the placeholder flag of a fallback title', () => {
    expect(channelRowModel({ title: '3 members', placeholderTitle: true, timestampLabel: '' }).placeholderTitle).toBe(true);
    expect(channelRowModel({ title: 'Team', timestampLabel: '' }).placeholderTitle).toBeUndefined();
  });

  test('highlight segments', () => {
    const p = channelRowModel({ title: 'Alice Smith', timestampLabel: '', highlightQuery: 'ali' });
    expect(p.titleSegments).toEqual([
      { text: 'Ali', emphasized: true },
      { text: 'ce Smith', emphasized: false },
    ]);
  });
});
