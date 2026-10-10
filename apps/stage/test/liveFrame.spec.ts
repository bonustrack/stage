import { describe, expect, test } from 'bun:test';
import type { NodeAction, NodeResult } from '@stage-labs/client/nodes/protocol';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import { makeLiveFrames } from '../lib/liveFrame.core';

const NODE = 'https://eth.example.com/price';
const SENT: FrameContent = { widget: { type: 'Card', children: [{ type: 'Title', value: '$100' }] }, source: { url: NODE } };
const NEXT = { type: 'Card', children: [{ type: 'Title', value: '$101' }] };
const LATER = { type: 'Card', children: [{ type: 'Title', value: '$102' }] };

interface NodeCall { method: 'GET' | 'POST'; url: string; key: string; action?: NodeAction }

const frameReply = (widget: Record<string, unknown>): NodeResult => ({ ok: true, reply: { kind: 'frame', frame: { widget } } });

function harness() {
  const calls: NodeCall[] = [];
  const toasts: string[] = [];
  let answer: () => Promise<NodeResult> = () => Promise.resolve(frameReply(NEXT));
  let keys = 0;
  const frames = makeLiveFrames({
    load: (url, key) => { calls.push({ method: 'GET', url, key }); return answer(); },
    act: (url, key, action) => { calls.push({ method: 'POST', url, key, action }); return answer(); },
    newKey: () => { keys += 1; return `key${keys}`; },
    now: () => 5_000,
    toast: (message) => { toasts.push(message); },
  });
  return { frames, calls, toasts, reply: (next: () => Promise<NodeResult>) => { answer = next; } };
}

describe('live frames in chats', () => {
  test('nothing is shown or called before a tap', () => {
    const h = harness();
    expect(h.frames.frameOf('m1')).toBeNull();
    expect(h.calls).toEqual([]);
  });

  test('a refresh loads the node with the frame key and shows the reply in place', async () => {
    const h = harness();
    let updates = 0;
    h.frames.subscribe(() => { updates += 1; });
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.calls).toEqual([{ method: 'GET', url: NODE, key: 'key1' }]);
    expect(h.frames.frameOf('m1')).toEqual({ widget: NEXT });
    expect(updates).toBe(1);
    expect(h.toasts).toEqual([]);
  });

  test('a tap posts the action, and each frame keeps its own key', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    await h.frames.act('m1', SENT, NODE, { type: 'buy', payload: { amount: 1 } });
    await h.frames.act('m2', SENT, NODE, { type: 'buy' });
    expect(h.calls).toEqual([
      { method: 'GET', url: NODE, key: 'key1' },
      { method: 'POST', url: NODE, key: 'key1', action: { type: 'buy', payload: { amount: 1 } } },
      { method: 'POST', url: NODE, key: 'key2', action: { type: 'buy' } },
    ]);
  });

  test('an unchanged reply keeps the frame as it was sent', async () => {
    const h = harness();
    h.reply(() => Promise.resolve({ ok: true, reply: { kind: 'unchanged' } }));
    await h.frames.act('m1', SENT, NODE, { type: 'noop' });
    expect(h.frames.frameOf('m1')).toEqual(SENT);
    expect(h.toasts).toEqual([]);
  });

  test('a failure keeps the shown frame and says why', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve({ ok: false, problem: 'status', status: 503 }));
    await h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve({ ok: false, problem: 'timeout' }));
    await h.frames.act('m1', SENT, NODE, { type: 'buy' });
    expect(h.frames.frameOf('m1')).toEqual({ widget: NEXT });
    expect(h.toasts).toEqual(['Could not refresh: node error 503', 'Could not send: timed out']);
  });

  test('a reply the frame renderer refuses is not shown', async () => {
    const h = harness();
    const deep = Array.from({ length: 20 }).reduce<Record<string, unknown>>(child => ({ type: 'Col', children: [child] }), { type: 'Text', value: 'x' });
    h.reply(() => Promise.resolve(frameReply({ type: 'Card', children: [deep] })));
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.frames.frameOf('m1')).toEqual(SENT);
    expect(h.toasts).toEqual(['Could not refresh: not a widget']);
  });

  test('clearing drops every frame, and a call still running then changes nothing', async () => {
    const h = harness();
    await h.frames.refresh('m1', SENT, NODE);
    const slow = Promise.withResolvers<NodeResult>();
    h.reply(() => slow.promise);
    const pending = h.frames.act('m1', SENT, NODE, { type: 'buy' });
    h.frames.clear();
    expect(h.frames.frameOf('m1')).toBeNull();
    slow.resolve({ ok: false, problem: 'unreachable' });
    await pending;
    expect(h.frames.frameOf('m1')).toBeNull();
    expect(h.toasts).toEqual([]);
    h.reply(() => Promise.resolve(frameReply(LATER)));
    await h.frames.refresh('m1', SENT, NODE);
    expect(h.calls.at(-1)).toEqual({ method: 'GET', url: NODE, key: 'key2' });
  });

  test('only the latest call on a frame updates it', async () => {
    const h = harness();
    const slow = Promise.withResolvers<NodeResult>();
    h.reply(() => slow.promise);
    const first = h.frames.refresh('m1', SENT, NODE);
    h.reply(() => Promise.resolve(frameReply(LATER)));
    await h.frames.act('m1', SENT, NODE, { type: 'next' });
    slow.resolve({ ok: false, problem: 'unreachable' });
    await first;
    expect(h.frames.frameOf('m1')).toEqual({ widget: LATER });
    expect(h.toasts).toEqual([]);
  });
});
