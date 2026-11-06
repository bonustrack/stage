import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { FrameContent, FrameMessage } from '@stage-labs/client/xmtp/frame';
import {
  frameCardModel,
  frameLinkOf,
  frameMoreBelow,
  frameMediaUrl,
  framePreviewCap,
  frameScreenTitle,
} from '../components/frame/frame.model';
import {
  frameActionContent,
  frameLocked,
  frameNodeOf,
  frameOf,
  frameRenders,
  isFrameActionEntry,
  nodeRequestOf,
} from '../lib/frames/frame.model';
import { frameKeysOf } from '../lib/frames/frameKeys';
import { frameStackOf, makeFrameStacks, navigateFrame, withFrameNav, type FrameStacks } from '../lib/frames/frameStacks';
import { isSplitRoute } from '../components/tabs/splitRoutes';
import { KIT_CATALOG, REFUSED_MESSAGES, actionOf, tapOf } from './frameFixtures';
import { entry, messageEntry } from './helpers';

function surface(surfaceId: string, components: Record<string, unknown>[]): FrameMessage {
  return { version: 'v1.0', createSurface: { surfaceId, catalogId: KIT_CATALOG, components } };
}

const REPORT = surface('home', [
  { id: 'root', component: 'Column', children: ['title', 'text'] },
  { id: 'title', component: 'Title', text: 'Weekly report' },
  { id: 'text', component: 'Text', text: 'Sales up 12%' },
]);

const report: FrameContent = { messages: [REPORT] };

const frameEntry = (content: unknown): HistoryEntry => messageEntry('msg-frame-1', 'frame', content);

describe('frameOf', () => {
  test('reads a valid frame from the entry payload', () => {
    expect(frameOf(frameEntry(report))).toEqual(report);
  });

  test('parses each payload once and returns the same frame', () => {
    const shown = frameEntry({ messages: [REPORT] });
    expect(frameOf(shown)).toBe(frameOf(shown));
  });

  test('ignores entries without a frame, with a broken one or with a ChatKit widget', () => {
    expect(frameOf(entry('plain'))).toBeNull();
    expect(frameOf(undefined)).toBeNull();
    expect(frameOf(frameEntry({ messages: 'Card' }))).toBeNull();
    expect(frameOf(frameEntry({ widget: { type: 'Card' } }))).toBeNull();
  });
});

describe('isFrameActionEntry', () => {
  test('only an entry carrying a decoded frame action is a frame tap', () => {
    const frameAction = { frameId: 'msg-frame-1', action: actionOf('approve'), label: 'Approve' };
    expect(isFrameActionEntry(messageEntry('tap', 'frameAction', frameAction))).toBe(true);
    expect(isFrameActionEntry(messageEntry('tap', 'frameAction', 'Frame action: approve'))).toBe(false);
    expect(isFrameActionEntry(frameEntry(report))).toBe(false);
    expect(isFrameActionEntry(entry('plain'))).toBe(false);
  });
});

describe('frameCardModel', () => {
  test('uses the explicit title and description first', () => {
    expect(frameCardModel({ ...report, title: 'Report', description: 'Week 39' })).toEqual({ title: 'Report', description: 'Week 39' });
  });

  test('derives them from the start surface when missing', () => {
    expect(frameCardModel(report)).toEqual({ title: 'Weekly report', description: 'Sales up 12%' });
  });

  test('falls back to Frame and drops a description equal to the title', () => {
    expect(frameCardModel({ messages: [surface('a', [{ id: 'root', component: 'Divider' }])] })).toEqual({ title: 'Frame' });
    expect(frameCardModel({ ...report, title: 'Same', description: ' Same ' })).toEqual({ title: 'Same' });
  });
});

describe('frame navigation and actions', () => {
  test('the frame page is a split route opened with the conversation and message ids', () => {
    expect(frameLinkOf('conv1', 'msg-frame-1')).toEqual({ pathname: '/frame', params: { convId: 'conv1', id: 'msg-frame-1' } });
    expect(isSplitRoute('/frame')).toBe(true);
  });

  test('a tap becomes frame action content with its label and the data model it asked to send', () => {
    const tap = tapOf('approve', { week: 39 });
    const action = actionOf('approve', { week: 39 });
    expect(frameActionContent('msg-frame-1', { ...tap, label: ' Approve ' })).toEqual({ frameId: 'msg-frame-1', action, label: 'Approve' });
    const metadata = { a2uiRendererDataModel: { version: 'v1.0' as const, surfaces: { main: { week: 39 } } } };
    expect(frameActionContent('msg-frame-1', { ...tap, metadata })).toEqual({
      frameId: 'msg-frame-1',
      action,
      dataModel: { main: { week: 39 } },
    });
    expect(nodeRequestOf({ ...tap, metadata })).toEqual({ message: tap.message, dataModel: { main: { week: 39 } } });
  });

  test('only an action message goes to the chat', () => {
    const call = {
      version: 'v1.0' as const,
      callAgentFunction: { surfaceId: 'main', functionCallId: 'f1', callFunction: { '@call': 'quote' } },
    };
    expect(frameActionContent('msg-frame-1', { message: call })).toBeNull();
  });

  test('an action too large to decode is not sent', () => {
    expect(frameActionContent('msg-frame-1', { ...tapOf('save', { note: 'x'.repeat(20_000) }), label: 'Save' })).toBeNull();
  });
});

describe('frames with a node source', () => {
  test('a frame names its node only with an allowed https link', () => {
    expect(frameNodeOf({ ...report, source: { url: 'https://nodes.stage.box/abc' } })).toEqual({
      url: 'https://nodes.stage.box/abc',
      host: 'nodes.stage.box',
    });
    expect(frameNodeOf(report)).toBeNull();
    expect(frameNodeOf({ ...report, source: { url: 'http://btc.example.com/' } })).toBeNull();
    expect(frameNodeOf({ ...report, source: { url: 'https://localhost/' } })).toBeNull();
    expect(frameNodeOf({ ...report, source: { url: 'https://user:pw@btc.example.com/' } })).toBeNull();
  });

  test('a frame with a node stays read only until the chat is known to be accepted', () => {
    const sourced = { ...report, source: { url: 'https://nodes.stage.box/abc' } };
    expect([true, false, undefined].map((allowed) => frameLocked(sourced, allowed))).toEqual([false, true, true]);
    expect([true, false, undefined].map((allowed) => frameLocked(report, allowed))).toEqual([false, true, false]);
    expect(frameLocked({ ...report, source: { url: 'http://btc.example.com/' } }, undefined)).toBe(false);
  });
});

describe('frames with several surfaces', () => {
  const story = surface('s1', [{ id: 'root', component: 'Title', text: 'Story one' }]);
  const plain = surface('s2', [{ id: 'root', component: 'Divider' }]);
  const frame: FrameContent = { title: 'Hacker News', messages: [REPORT, story, plain] };

  test('the card is summed up from the start surface', () => {
    expect(frameCardModel({ messages: [REPORT, story] })).toEqual({ title: 'Weekly report', description: 'Sales up 12%' });
    expect(frameCardModel({ messages: [REPORT, story], start: 's1' })).toEqual({ title: 'Story one' });
  });

  test('the top nav shows the surface title, else the frame title', () => {
    expect(frameScreenTitle(frame, 'home')).toBe('Hacker News');
    expect(frameScreenTitle(frame, 's1')).toBe('Story one');
    expect(frameScreenTitle(frame, 's2')).toBe('Hacker News');
    expect(frameScreenTitle(frame, 'missing')).toBe('Hacker News');
  });
});

describe('frame rendering and live updates', () => {
  test('a frame renders when a surface has a valid root', () => {
    expect(frameRenders(report)).toBe(true);
    expect(frameRenders({ messages: REFUSED_MESSAGES })).toBe(false);
    const cycle = {
      version: 'v1.0',
      createSurface: { surfaceId: 's', catalogId: KIT_CATALOG, components: [{ id: 'root', component: 'Column', children: ['root'] }] },
    };
    expect(frameRenders({ messages: [cycle] })).toBe(false);
  });
});

describe('frame media', () => {
  test('images, videos and audio load from https only', () => {
    expect(frameMediaUrl(' https://img.example.com/a.png ')).toBe('https://img.example.com/a.png');
    for (const url of ['http://img.example.com/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'https:///x', ''])
      expect(frameMediaUrl(url)).toBe('');
  });
});

describe('the frame preview in the feed', () => {
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

  test('a frame starts on its start surface', () => {
    expect(frameStackOf(undefined, 'home')).toEqual(['home']);
    expect(frameStackOf(['other', 's1'], 'home')).toEqual(['home']);
  });

  test('each frame keeps its own stack, shared by the feed and the full view', () => {
    const one = withFrameNav(none, 'msg-1', 'home', { kind: 'open', surfaceId: 's1' });
    const both = withFrameNav(one, 'msg-2', 'home', { kind: 'open', surfaceId: 's2' });
    expect(frameStackOf(both.get('msg-1'), 'home')).toEqual(['home', 's1']);
    expect(frameStackOf(both.get('msg-2'), 'home')).toEqual(['home', 's2']);
    expect(none.size).toBe(0);
  });

  test('closing back to the start surface forgets the frame', () => {
    const open = withFrameNav(none, 'msg-1', 'home', { kind: 'open', surfaceId: 's1' });
    const back = withFrameNav(open, 'msg-1', 'home', { kind: 'close' });
    expect(back.has('msg-1')).toBe(false);
    expect(frameStackOf(back.get('msg-1'), 'home')).toEqual(['home']);
  });

  test('a step that changes nothing keeps the same stacks, and the stack stops at 20 screens', () => {
    expect(withFrameNav(none, 'msg-1', 'home', { kind: 'close' })).toBe(none);
    const open = withFrameNav(none, 'msg-1', 'home', { kind: 'open', surfaceId: 's1' });
    expect(withFrameNav(open, 'msg-1', 'home', { kind: 'open', surfaceId: 's1' })).toBe(open);
    const deep = Array.from({ length: 30 }, (_, i) => `s${i}`).reduce<readonly string[]>(
      (stack, id) => navigateFrame(stack, { kind: 'open', surfaceId: id }),
      ['home'],
    );
    expect(deep).toHaveLength(20);
  });

  test('a stack store tells its views about each step, and clearing sends every frame back to its start', () => {
    const stacks = makeFrameStacks();
    let changes = 0;
    stacks.subscribe(() => {
      changes += 1;
    });
    stacks.navigate('msg-1', 'home', { kind: 'open', surfaceId: 's1' });
    stacks.navigate('msg-1', 'home', { kind: 'open', surfaceId: 's1' });
    expect([stacks.stackOf('msg-1'), changes]).toEqual([['home', 's1'], 1]);
    stacks.clear();
    stacks.clear();
    expect([stacks.stackOf('msg-1'), changes]).toEqual([undefined, 2]);
  });
});

describe('the keys of a shown frame', () => {
  test('a chat frame keeps one session per account and one screen stack per message', () => {
    expect(frameKeysOf({ kind: 'chat', epoch: 3, messageId: 'msg-1' })).toEqual({ session: '3:msg-1', stack: 'msg-1' });
  });

  test('widgets and add previews use one key for their session and their screens', () => {
    expect(frameKeysOf({ kind: 'widget', widgetId: 'w1' })).toEqual({ session: 'live:w1', stack: 'live:w1' });
    expect(frameKeysOf({ kind: 'linkPreview', nodeKey: 'k1' })).toEqual({ session: 'preview:k1', stack: 'preview:k1' });
    expect(frameKeysOf({ kind: 'codePreview', nodeKey: 'k1' })).toEqual({ session: 'node:k1', stack: 'node:k1' });
  });
});
