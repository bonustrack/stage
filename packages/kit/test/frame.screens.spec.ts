import { describe, expect, test } from 'bun:test';
import {
  FRAME_LIMITS, frameNavOf, navigateFrame, parseFrameDoc, withScreen, type FrameDoc,
} from '../src/frame';

const list = {
  type: 'ListView',
  children: [{ type: 'ListViewItem', onClickAction: { type: 'frame.open', payload: { screen: 's1' } }, children: [{ type: 'Text', value: 'Story' }] }],
};
const detail = { type: 'Card', children: [{ type: 'Title', value: 'Story' }, { type: 'Button', label: 'Back', onClickAction: { type: 'frame.back' } }] };

function doc(raw: unknown): FrameDoc {
  const parsed = parseFrameDoc(raw);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error}`);
  return parsed.doc;
}

describe('parseFrameDoc', () => {
  test('a plain widget is one screen, as before', () => {
    const single = doc({ type: 'Card', children: [] });
    expect(single.multi).toBe(false);
    expect([...single.screens.keys()]).toEqual(['']);
    expect(single.screens.get(single.start)?.root.type).toBe('Card');
  });

  test('screens take a bare widget or a titled one, and start picks the first screen', () => {
    const multi = doc({ screens: { home: list, s1: { title: ' Story 1 ', widget: detail } } });
    expect(multi.multi).toBe(true);
    expect(multi.start).toBe('home');
    expect(multi.screens.get('home')).toEqual({ root: expect.objectContaining({ type: 'ListView' }) });
    expect(multi.screens.get('s1')?.title).toBe('Story 1');
    expect(multi.screens.get('s1')?.root.type).toBe('Card');
  });

  test('the default start skips number ids, which JSON lists first', () => {
    const parsed = doc(JSON.parse('{"screens":{"home":{"type":"Card"},"41234567":{"type":"Card"}}}'));
    expect([...parsed.screens.keys()]).toEqual(['41234567', 'home']);
    expect(parsed.start).toBe('home');
    expect(doc({ screens: { 2: detail, 1: detail } }).start).toBe('1');
  });

  test('a widget with a screens prop stays one widget', () => {
    expect(doc({ type: 'Card', screens: { home: list } }).multi).toBe(false);
  });

  test('an explicit start wins, even when it names no screen', () => {
    expect(doc({ screens: { home: list, s1: detail }, start: 's1' }).start).toBe('s1');
    const lost = doc({ screens: { home: list }, start: 'nope' });
    expect(lost.screens.get(lost.start)).toBeUndefined();
  });

  test('empty or unusable screen ids are dropped', () => {
    expect([...doc({ screens: { '': list, home: detail, [`${'x'.repeat(121)}`]: list } }).screens.keys()]).toEqual(['home']);
    expect(parseFrameDoc({ screens: {} })).toEqual({ ok: false, error: 'invalid' });
  });

  test('a broken screen fails the whole frame', () => {
    expect(parseFrameDoc({ screens: { home: list, s1: 'Card' } })).toEqual({ ok: false, error: 'invalid' });
    let deep: Record<string, unknown> = { type: 'Text', value: 'x' };
    for (let i = 0; i <= FRAME_LIMITS.maxDepth; i += 1) deep = { type: 'Box', children: [deep] };
    expect(parseFrameDoc({ screens: { home: list, s1: { type: 'Card', children: [deep] } } })).toEqual({ ok: false, error: 'too-deep' });
  });

  test('the limits hold over the whole set of screens', () => {
    const many = Object.fromEntries(Array.from({ length: FRAME_LIMITS.maxScreens + 1 }, (_, i) => [`s${i}`, detail]));
    expect(parseFrameDoc({ screens: many })).toEqual({ ok: false, error: 'too-many-screens' });
    const half = { type: 'Card', children: [{ type: 'Text', value: 'x'.repeat(FRAME_LIMITS.maxChars / 2) }] };
    expect(parseFrameDoc({ screens: { a: half, b: half } })).toEqual({ ok: false, error: 'too-large' });
    expect(parseFrameDoc({ screens: { a: half } }).ok).toBe(true);
  });
});

describe('frame navigation', () => {
  test('frame.open and frame.back are read from actions, others are not', () => {
    expect(frameNavOf({ type: 'frame.open', payload: { screen: 's1' } })).toEqual({ kind: 'open', screen: 's1' });
    expect(frameNavOf({ type: 'frame.open' })).toEqual({ kind: 'open', screen: '' });
    expect(frameNavOf({ type: 'frame.back' })).toEqual({ kind: 'back' });
    expect(frameNavOf({ type: 'vote', payload: { screen: 's1' } })).toBeUndefined();
    expect(frameNavOf(undefined)).toBeUndefined();
  });

  test('open pushes onto the stack, the same screen twice does not', () => {
    const stack = navigateFrame(['home'], { kind: 'open', screen: 's1' });
    expect(stack).toEqual(['home', 's1']);
    expect(navigateFrame(stack, { kind: 'open', screen: 's1' })).toBe(stack);
    expect(navigateFrame(stack, { kind: 'open', screen: 's2' })).toEqual(['home', 's1', 's2']);
  });

  test('back pops to the previous screen and stays on the first one', () => {
    expect(navigateFrame(['home', 's1', 's2'], { kind: 'back' })).toEqual(['home', 's1']);
    const first = ['home'];
    expect(navigateFrame(first, { kind: 'back' })).toBe(first);
  });

  test('an unknown screen is pushed, so back still works from its notice', () => {
    const multi = doc({ screens: { home: list } });
    const stack = navigateFrame([multi.start], { kind: 'open', screen: 'missing' });
    expect(multi.screens.get(stack[stack.length - 1] ?? '')).toBeUndefined();
    expect(navigateFrame(stack, { kind: 'back' })).toEqual(['home']);
  });

  test('the stack is capped', () => {
    let stack: readonly string[] = ['home'];
    for (let i = 0; i < 80; i += 1) stack = navigateFrame(stack, { kind: 'open', screen: `s${i}` });
    expect(stack).toHaveLength(50);
    expect(stack[0]).toBe('home');
    expect(stack[stack.length - 1]).toBe('s79');
  });
});

describe('withScreen', () => {
  test('adds the current screen to the payload, and a payload key wins', () => {
    expect(withScreen({ type: 'vote' }, 's1')).toEqual({ type: 'vote', payload: { screen: 's1' } });
    expect(withScreen({ type: 'vote', payload: { id: 3 } }, 's1')).toEqual({ type: 'vote', payload: { screen: 's1', id: 3 } });
    expect(withScreen({ type: 'vote', payload: { screen: 'mine' } }, 's1')).toEqual({ type: 'vote', payload: { screen: 'mine' } });
    expect(withScreen({ type: 'ask', handler: 'client' }, 's1')).toEqual({ type: 'ask', handler: 'client', payload: { screen: 's1' } });
  });
});
