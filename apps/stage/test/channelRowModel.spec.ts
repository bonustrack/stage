import { describe, expect, test } from 'bun:test';
import { channelRowModel } from '../components/ChannelRow.model';

describe('channelRowModel', () => {
  test('minimal domain maps to empty-preview params', () => {
    const p = channelRowModel({ title: 'Alice', timestampLabel: '' });
    expect(p).toEqual({
      title: 'Alice',
      titleSegments: undefined,
      preview: '',
      previewPrefix: undefined,
      timestamp: '',
      chips: undefined,
      pinned: undefined,
    });
  });

  test('draft wins over preview and adds You: prefix, suppressing chips', () => {
    const p = channelRowModel({
      title: 'Alice',
      lastPreview: 'hello', hasDraft: true, draftText: '  wip  ',
      labels: ['a', 'b', 'c'], timestampLabel: '9:15 AM',
    });
    expect(p.preview).toBe('wip');
    expect(p.previewPrefix).toBe('You:');
    expect(p.chips).toBeUndefined();
    expect(p.timestamp).toBe('9:15 AM');
  });

  test('a draft sharing a channel shows the channel name, not its link', () => {
    const p = channelRowModel({
      title: 'Alice', hasDraft: true, timestampLabel: '',
      draftText: 'see [#Ops night shift](https://stage.box/#/channel/2e793fb8087052ca59109ca900e53de9) ',
    });
    expect(p.preview).toBe('see #Ops night shift');
  });

  test('labels truncate to two with overflow chip', () => {
    const p = channelRowModel({ title: 'Alice', timestampLabel: '', labels: ['a', 'b', 'c', 'd'] });
    expect(p.chips).toEqual([{ label: 'a' }, { label: 'b' }, { label: '+2' }]);
  });

  test('preview falls back lastPreview -> subtitle -> empty', () => {
    const base = { title: 't', timestampLabel: '' };
    expect(channelRowModel({ ...base, lastPreview: 'p', subtitle: 's' }).preview).toBe('p');
    expect(channelRowModel({ ...base, lastPreview: '', subtitle: 's' }).preview).toBe('s');
    expect(channelRowModel(base).preview).toBe('');
  });

  test('highlight segments', () => {
    const p = channelRowModel({ title: 'Alice Smith', timestampLabel: '', highlightQuery: 'ali' });
    expect(p.titleSegments).toEqual([
      { text: 'Ali', emphasized: true },
      { text: 'ce Smith', emphasized: false },
    ]);
  });
});
