import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { frameActionContent, frameCardModel, frameLinkOf, frameOf } from '../components/frame/frame.model';
import { isSplitRoute } from '../components/tabs/splitRoutes';

const base: HistoryEntry = {
  id: 'msg-frame-1', ts: '2026-10-01T04:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/a/conv1',
  from: 'stage://xmtp/a/user/agent', to: 'stage://xmtp/a/conv1', messageId: 'msg-frame-1',
};

const widget = {
  type: 'Card',
  children: [{ type: 'Title', value: 'Weekly report' }, { type: 'Text', value: 'Sales up 12%' }],
};

describe('frameOf', () => {
  test('reads a valid frame from the entry payload', () => {
    expect(frameOf({ ...base, payload: { contentType: 'frame', frame: { widget } } })).toEqual({ widget });
  });

  test('ignores entries without a frame or with a broken one', () => {
    expect(frameOf(base)).toBeNull();
    expect(frameOf(undefined)).toBeNull();
    expect(frameOf({ ...base, payload: { contentType: 'frame', frame: { widget: 'Card' } } })).toBeNull();
  });
});

describe('frameCardModel', () => {
  test('uses the explicit title and description first', () => {
    expect(frameCardModel({ title: 'Report', description: 'Week 39', widget })).toEqual({ title: 'Report', description: 'Week 39' });
  });

  test('derives them from the widget when missing', () => {
    expect(frameCardModel({ widget })).toEqual({ title: 'Weekly report', description: 'Sales up 12%' });
  });

  test('falls back to Frame and drops a description equal to the title', () => {
    expect(frameCardModel({ widget: { type: 'Card' } })).toEqual({ title: 'Frame' });
    expect(frameCardModel({ title: 'Same', description: ' Same ', widget })).toEqual({ title: 'Same' });
    expect(frameCardModel({ title: '  ', widget: { type: 'Iframe' } })).toEqual({ title: 'Frame' });
  });
});

describe('frame navigation and actions', () => {
  test('the frame page is a split route opened with the conversation and message ids', () => {
    expect(frameLinkOf('conv1', 'msg-frame-1')).toEqual({ pathname: '/frame', params: { convId: 'conv1', id: 'msg-frame-1' } });
    expect(isSplitRoute('/frame')).toBe(true);
  });

  test('an action becomes frame action content', () => {
    expect(frameActionContent('msg-frame-1', { type: 'approve', payload: { week: 39 } }, ' Approve '))
      .toEqual({ frameId: 'msg-frame-1', action: { type: 'approve', payload: { week: 39 } }, label: 'Approve' });
    expect(frameActionContent('msg-frame-1', { type: 'pick' }, undefined)).toEqual({ frameId: 'msg-frame-1', action: { type: 'pick' } });
  });

  test('an action too large to decode is not sent', () => {
    expect(frameActionContent('msg-frame-1', { type: 'save', payload: { note: 'x'.repeat(20_000) } }, 'Save')).toBeNull();
  });
});
