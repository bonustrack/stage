import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { parseFrameDoc } from '@stage-labs/kit/frame';
import { kitPalette } from '@stage-labs/kit/tokens';
import {
  frameActionContent, frameBackdrop, frameCardModel, frameInputOf, frameLinkOf, frameMoreBelow, frameOf, framePreviewCap,
  frameScreenTitle, frameStackOf, withFrameNav, type FrameStacks,
} from '../components/frame/frame.model';
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

describe('frames with screens', () => {
  const detail = { type: 'Card', children: [{ type: 'Title', value: 'Story one' }] };
  const frame = { title: 'Hacker News', screens: { home: widget, s1: { title: 'Story', widget: detail }, s2: detail }, start: 'home' };

  test('a frame with screens is read, and needs a widget or screens', () => {
    expect(frameOf({ ...base, payload: { contentType: 'frame', frame } })).toEqual(frame);
    expect(frameOf({ ...base, payload: { contentType: 'frame', frame: { title: 'x' } } })).toBeNull();
    expect(frameOf({ ...base, payload: { contentType: 'frame', frame: { widget, screens: { home: widget } } } })).toBeNull();
  });

  test('the frame input is the widget or the screens with their start', () => {
    expect(frameInputOf({ widget })).toBe(widget);
    expect(frameInputOf(frame)).toEqual({ screens: frame.screens, start: 'home' });
  });

  test('the card is summed up from the start screen', () => {
    expect(frameCardModel({ screens: { home: widget, s1: detail } })).toEqual({ title: 'Weekly report', description: 'Sales up 12%' });
    expect(frameCardModel({ screens: { home: widget, s1: detail }, start: 's1' })).toEqual({ title: 'Story one' });
  });

  test('the top nav shows the screen title, else the frame title', () => {
    const parsed = parseFrameDoc(frameInputOf(frame));
    expect(frameScreenTitle(frame, parsed, 's1')).toBe('Story');
    expect(frameScreenTitle(frame, parsed, 's2')).toBe('Hacker News');
    expect(frameScreenTitle(frame, parsed, 'missing')).toBe('Hacker News');
  });
});

describe('the frame preview in the feed', () => {
  const light = kitPalette('light');
  const dark = kitPalette('dark');

  test('the backdrop is the start screen root background, else the page background', () => {
    expect(frameBackdrop({ widget }, 'light', light)).toBe(light.bg);
    expect(frameBackdrop({ widget: { type: 'Card', background: '#1d4ed8' } }, 'dark', dark)).toBe('#1d4ed8');
    expect(frameBackdrop({ widget: { type: 'Basic', background: { light: '#ffffff', dark: '#000000' } } }, 'dark', dark)).toBe('#000000');
    expect(frameBackdrop({ screens: { home: { type: 'Card', background: '#123456' }, s1: widget } }, 'light', light)).toBe('#123456');
    expect(frameBackdrop({ widget: { type: 'Iframe' } }, 'light', light)).toBe(light.bg);
  });

  test('a root with its own theme uses that theme', () => {
    expect(frameBackdrop({ widget: { type: 'ListView', theme: 'dark', children: [] } }, 'light', light)).toBe(dark.bg);
    expect(frameBackdrop({ widget: { type: 'Card', theme: 'light', background: { light: '#eeeeee', dark: '#111111' } } }, 'dark', dark)).toBe('#eeeeee');
  });

  test('the backdrop follows the screen shown in the feed', () => {
    const frame = { screens: { home: { type: 'Card', background: '#123456' }, s1: { type: 'Card', background: '#654321' } } };
    expect(frameBackdrop(frame, 'light', light, 's1')).toBe('#654321');
    expect(frameBackdrop(frame, 'light', light, 'missing')).toBe(light.bg);
  });

  test('it scrolls inside the image height less its border, and less the back bar on a later screen', () => {
    expect(framePreviewCap(0)).toBe(398);
    expect(framePreviewCap(2)).toBe(358);
  });

  test('the fade shows only while more content is below', () => {
    expect(frameMoreBelow({ content: 300, viewport: 300, offset: 0 })).toBe(false);
    expect(frameMoreBelow({ content: 900, viewport: 398, offset: 0 })).toBe(true);
    expect(frameMoreBelow({ content: 900, viewport: 398, offset: 500 })).toBe(true);
    expect(frameMoreBelow({ content: 900, viewport: 398, offset: 501 })).toBe(false);
  });
});

describe('the screen stack of each frame', () => {
  const none: FrameStacks = new Map();

  test('a frame starts on its start screen', () => {
    expect(frameStackOf(undefined, 'home')).toEqual(['home']);
    expect(frameStackOf(['other', 's1'], 'home')).toEqual(['home']);
  });

  test('each frame keeps its own stack, shared by the feed and the full view', () => {
    const one = withFrameNav(none, 'msg-1', 'home', { kind: 'open', screen: 's1' });
    const both = withFrameNav(one, 'msg-2', 'home', { kind: 'open', screen: 's2' });
    expect(frameStackOf(both.get('msg-1'), 'home')).toEqual(['home', 's1']);
    expect(frameStackOf(both.get('msg-2'), 'home')).toEqual(['home', 's2']);
    expect(none.size).toBe(0);
  });

  test('going back to the start screen forgets the frame', () => {
    const open = withFrameNav(none, 'msg-1', 'home', { kind: 'open', screen: 's1' });
    const back = withFrameNav(open, 'msg-1', 'home', { kind: 'back' });
    expect(back.has('msg-1')).toBe(false);
    expect(frameStackOf(back.get('msg-1'), 'home')).toEqual(['home']);
  });

  test('a step that changes nothing keeps the same stacks', () => {
    expect(withFrameNav(none, 'msg-1', 'home', { kind: 'back' })).toBe(none);
    const open = withFrameNav(none, 'msg-1', 'home', { kind: 'open', screen: 's1' });
    expect(withFrameNav(open, 'msg-1', 'home', { kind: 'open', screen: 's1' })).toBe(open);
  });
});
