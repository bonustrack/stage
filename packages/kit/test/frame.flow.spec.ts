import { describe, expect, test } from 'bun:test';
import { frameFlex, parseFrame, type FrameNode } from '../src/frame';
import {
  FRAME_ROOT_FLOW, frameBlockSize, frameChildFlow, frameFieldStyle, frameSpacerStyle, type FrameFlow,
} from '../src/frame.flow';

function root(widget: unknown): FrameNode {
  const parsed = parseFrame(widget);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error}`);
  return parsed.root;
}

function only(node: Record<string, unknown>): FrameNode {
  const child = root({ type: 'Card', children: [node] }).children[0];
  if (child === undefined) throw new Error('no child');
  return child;
}

function flowAt(node: FrameNode, path: number[], parent: FrameFlow = FRAME_ROOT_FLOW): FrameFlow {
  const flow = frameChildFlow(node, parent) ?? parent;
  const [head, ...rest] = path;
  if (head === undefined) return flow;
  const child = node.children[head];
  if (child === undefined) throw new Error(`no child ${head}`);
  return flowAt(child, rest, flow);
}

const BUBBLE = { light: '#f4f4f4', dark: '#303030' };

describe('parseFrame: ChatKit sizing props', () => {
  test('Box takes width, height and their min and max, as px or %', () => {
    expect(only({ type: 'Box', width: 120, minWidth: '40px', maxWidth: '80%', height: '50%', minHeight: 24, maxHeight: 300 }).props)
      .toEqual({ width: 120, minWidth: 40, maxWidth: '80%', height: '50%', minHeight: 24, maxHeight: 300 });
  });

  test('minSize and maxSize are kept on Box, Row, Col and Image', () => {
    expect(only({ type: 'Row', minSize: 48, maxSize: '90%' }).props).toEqual({ minSize: 48, maxSize: '90%' });
    expect(only({ type: 'Image', src: 'https://x.y/a.png', minSize: 20 }).props).toEqual({ src: 'https://x.y/a.png', minSize: 20 });
  });

  test('bad lengths are dropped', () => {
    expect(only({ type: 'Box', maxWidth: '80vw', minWidth: '1000%', width: -5 }).props).toEqual({ width: 0 });
  });

  test('padding takes the object form on Box, Card, Basic and Table.Cell', () => {
    expect(only({ type: 'Box', padding: { x: 4, y: 3 } }).props.padding).toEqual({ top: 12, right: 16, bottom: 12, left: 16 });
    expect(only({ type: 'Col', padding: { y: 2, top: 1, left: '10px' } }).props.padding)
      .toEqual({ top: 4, right: undefined, bottom: 8, left: 10 });
    expect(root({ type: 'Basic', padding: { x: 0, y: 2 }, children: [] }).props).toEqual({ padding: { top: 8, right: 0, bottom: 8, left: 0 } });
    const cell = only({
      type: 'Table', children: [{ type: 'Table.Row', children: [{ type: 'Table.Cell', padding: { x: 2 }, children: [] }] }],
    }).children[0]?.children[0];
    expect(cell?.props).toEqual({ padding: { top: undefined, right: 8, bottom: undefined, left: 8 } });
  });

  test('radius tokens up to 4xl, full and none', () => {
    for (const radius of ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full', '100%', 'none']) {
      expect(only({ type: 'Box', radius }).props).toEqual({ radius });
    }
    expect(only({ type: 'Box', radius: '5xl' }).props).toEqual({});
  });

  test('Text size and field variants', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) expect(only({ type: 'Text', value: 'a', size }).props).toEqual({ value: 'a', size });
    expect(only({ type: 'Input', name: 'm', variant: 'soft' }).props).toEqual({ name: 'm', variant: 'soft' });
    expect(only({ type: 'Textarea', name: 'm', variant: 'outline', rows: 1 }).props).toEqual({ name: 'm', variant: 'outline', rows: 1 });
    expect(only({ type: 'Input', name: 'm', variant: 'ghost' }).props).toEqual({ name: 'm' });
  });
});

describe('frameChildFlow', () => {
  test('Row and ListViewItem lay out in a row, Col, Card and cells in a column', () => {
    expect(frameChildFlow(only({ type: 'Row' }), FRAME_ROOT_FLOW)).toEqual({ direction: 'row', filled: false });
    expect(frameChildFlow(only({ type: 'Col' }), FRAME_ROOT_FLOW)).toEqual({ direction: 'col', filled: false });
    expect(frameChildFlow(only({ type: 'Box' }), FRAME_ROOT_FLOW)?.direction).toBe('col');
    expect(frameChildFlow(only({ type: 'Box', direction: 'row' }), FRAME_ROOT_FLOW)?.direction).toBe('row');
    expect(frameChildFlow(only({ type: 'Form', direction: 'row' }), FRAME_ROOT_FLOW)?.direction).toBe('row');
    expect(frameChildFlow(root({ type: 'ListView', children: [{ type: 'ListViewItem', children: [] }] }).children[0] as FrameNode, FRAME_ROOT_FLOW)?.direction)
      .toBe('row');
  });

  test('leaf and pass-through nodes keep the parent flow', () => {
    expect(frameChildFlow(only({ type: 'Text', value: 'x' }), FRAME_ROOT_FLOW)).toBeUndefined();
    expect(frameChildFlow(only({ type: 'Transition', children: { type: 'Text', value: 'x' } }), FRAME_ROOT_FLOW)).toBeUndefined();
    expect(frameChildFlow(only({ type: 'Table', children: [] }), FRAME_ROOT_FLOW)).toBeUndefined();
  });

  test('a background fills every container below it, a Card starts clean', () => {
    const filled = { direction: 'col', filled: true } as const;
    expect(frameChildFlow(only({ type: 'Box', background: '#303030' }), FRAME_ROOT_FLOW)).toEqual(filled);
    expect(frameChildFlow(only({ type: 'Row' }), filled)).toEqual({ direction: 'row', filled: true });
    expect(frameChildFlow(root({ type: 'Card', background: '#303030', children: [] }), filled)).toEqual({ direction: 'col', filled: false });
    expect(frameChildFlow(root({ type: 'Basic', background: '#212121', children: [] }), FRAME_ROOT_FLOW)).toEqual({ direction: 'col', filled: false });
  });
});

describe('frameFieldStyle', () => {
  const row = { direction: 'row', filled: false } as const;
  const col = { direction: 'col', filled: false } as const;

  test('a growing field fills a row and stretches across a column', () => {
    expect(frameFieldStyle(row, true, undefined)).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 });
    expect(frameFieldStyle(col, true, 'outline')).toEqual({ alignSelf: 'stretch' });
    expect(frameFieldStyle(row, false, 'soft')).toEqual({});
  });

  test('a soft field blends into a filled container, an outline one keeps its look', () => {
    expect(frameFieldStyle({ ...row, filled: true }, true, 'soft').backgroundColor).toBe('transparent');
    expect(frameFieldStyle({ ...col, filled: true }, true, undefined).backgroundColor).toBe('transparent');
    expect(frameFieldStyle({ ...row, filled: true }, true, 'outline').backgroundColor).toBeUndefined();
    expect(frameFieldStyle({ ...row, filled: true }, false, 'solid').backgroundColor).toBeUndefined();
    expect(frameFieldStyle(col, false, 'soft').backgroundColor).toBeUndefined();
    expect(frameFieldStyle(col, false, 'ghost').backgroundColor).toBe('transparent');
  });
});

describe('frameSpacerStyle and frameBlockSize', () => {
  test('Spacer minSize applies along the parent direction only', () => {
    expect(frameSpacerStyle('row', 64)).toEqual({ minWidth: 64 });
    expect(frameSpacerStyle('col', '10%')).toEqual({ minHeight: '10%' });
    expect(frameSpacerStyle('row', undefined)).toEqual({});
  });

  test('minSize and maxSize fill both axes unless a side is set', () => {
    expect(frameBlockSize({ minSize: 20, maxSize: '50%', maxWidth: 300, radius: 'lg' }))
      .toEqual({ minWidth: 20, minHeight: 20, maxWidth: 300, maxHeight: '50%', radius: 'lg' });
    expect('minSize' in frameBlockSize({ minSize: 1 })).toBe(false);
  });

  test('a box with its own minSize keeps it when it shrinks', () => {
    expect(frameFlex(only({ type: 'Box', minSize: 48 }))).toEqual({ flexShrink: 1 });
  });
});

describe('ChatGPT composer and bubbles', () => {
  const chat = root({
    type: 'Basic', background: { light: '#ffffff', dark: '#212121' }, padding: 0,
    children: [
      { type: 'Row', children: [{ type: 'Spacer', minSize: 64 }, { type: 'Box', background: BUBBLE, maxWidth: '80%', padding: { x: 4, y: 3 }, children: [{ type: 'Text', value: 'Hi' }] }] },
      {
        type: 'Form', onSubmitAction: { type: 'send' },
        children: [{ type: 'Box', background: BUBBLE, radius: 'full', children: [{ type: 'Row', children: [{ type: 'Button', iconStart: 'plus' }, { type: 'Input', name: 'message' }, { type: 'Button', iconStart: 'arrow-up', submit: true }] }] }],
      },
    ],
  });

  test('the user bubble hugs its text up to 80% and the Spacer keeps 64px on the left only', () => {
    expect(chat.children[0]?.children[1]?.props).toMatchObject({ maxWidth: '80%' });
    expect(frameSpacerStyle(flowAt(chat, [0]).direction, 64)).toEqual({ minWidth: 64 });
  });

  test('the composer Input fills the row and blends into the filled Box', () => {
    expect(frameFieldStyle(flowAt(chat, [1, 0, 0]), true, undefined)).toEqual({
      flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, backgroundColor: 'transparent',
    });
  });
});
