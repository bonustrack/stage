import { describe, expect, test } from 'bun:test';
import { newNodeKey, type NodeResult } from '@stage-labs/client/nodes/protocol';
import { ownNodeUrl } from '@stage-labs/client/nodes/publish';
import {
  EMPTY_LIVE, LIVE_REFRESH_MS, NODE_URL_HINTS, liveConfirmOf, livePreviewOf, liveProblemText, liveRefetchInterval, liveRefreshDelay,
  liveSnapshotJson, liveSnapshotOf, liveStateAfter, liveStatusText, ownsHostedNode, publishProblemText, type LiveState,
} from '../components/dashboard/liveWidget.model';

const CARD = { type: 'Card', children: [{ type: 'Title', value: '$100' }] };
const NEXT = { type: 'Card', children: [{ type: 'Title', value: '$101' }] };
const frameReply = (widget: Record<string, unknown>): NodeResult => ({ ok: true, reply: { kind: 'frame', frame: { widget } } });
const shown: LiveState = { frame: { widget: CARD }, at: 1_000, problem: null, status: null, failures: 0 };
const timeOf = (ms: number): string => `t${ms}`;

describe('live widget state', () => {
  test('a node frame replaces the shown frame and clears any problem', () => {
    expect(liveStateAfter(EMPTY_LIVE, frameReply(CARD), 1_000)).toEqual(shown);
    const failing = { ...shown, problem: 'timeout' as const, failures: 3 };
    expect(liveStateAfter(failing, frameReply(NEXT), 2_000)).toEqual({ frame: { widget: NEXT }, at: 2_000, problem: null, status: null, failures: 0 });
  });

  test('a failure keeps the last good frame and its time, and counts the failures', () => {
    const once = liveStateAfter(shown, { ok: false, problem: 'unreachable' }, 2_000);
    expect(once).toEqual({ ...shown, problem: 'unreachable', failures: 1 });
    expect(liveStateAfter(once, { ok: false, problem: 'status', status: 503 }, 3_000)).toEqual({ ...shown, problem: 'status', status: 503, failures: 2 });
  });

  test('an unchanged reply confirms the shown frame, and is a problem when nothing is shown yet', () => {
    expect(liveStateAfter({ ...shown, problem: 'timeout', failures: 2 }, { ok: true, reply: { kind: 'unchanged' } }, 5_000)).toEqual({ ...shown, at: 5_000 });
    expect(liveStateAfter(EMPTY_LIVE, { ok: true, reply: { kind: 'unchanged' } }, 5_000)).toEqual({ ...EMPTY_LIVE, problem: 'empty', failures: 1 });
  });

  test('a frame the renderer refuses counts as an invalid reply', () => {
    const deep = Array.from({ length: 20 }).reduce<Record<string, unknown>>(child => ({ type: 'Col', children: [child] }), { type: 'Text', value: 'x' });
    expect(liveStateAfter(shown, frameReply({ type: 'Card', children: [deep] }), 2_000)).toEqual({ ...shown, problem: 'invalid', failures: 1 });
  });
});

describe('live widget refresh', () => {
  test('refreshes every minute while active, backs off after failures up to 5 minutes, and never while hidden', () => {
    expect(LIVE_REFRESH_MS).toBe(60_000);
    expect(liveRefreshDelay(undefined)).toBe(60_000);
    expect([0, 1, 2, 3, 9].map(failures => liveRefreshDelay({ ...shown, failures }))).toEqual([60_000, 120_000, 240_000, 300_000, 300_000]);
    expect(liveRefetchInterval(true, shown)).toBe(60_000);
    expect(liveRefetchInterval(false, shown)).toBe(false);
    expect(liveRefetchInterval(false, undefined)).toBe(false);
  });
});

describe('live widget status', () => {
  test('a working widget shows no status, a failing one says why and when it last updated', () => {
    expect(liveStatusText(undefined, timeOf)).toBeNull();
    expect(liveStatusText(shown, timeOf)).toBeNull();
    expect(liveStatusText({ ...shown, problem: 'unreachable', failures: 1 }, timeOf)).toBe('Not reachable · t1000');
    expect(liveStatusText({ ...shown, problem: 'status', status: 500 }, timeOf)).toBe('Node error 500 · t1000');
    expect(liveStatusText({ ...EMPTY_LIVE, problem: 'timeout' }, timeOf)).toBe('Timed out');
    expect(liveProblemText({ problem: 'invalid', status: null })).toBe('Not a widget');
    expect(liveProblemText({ problem: null, status: null })).toBeNull();
  });

  test('adding a node from a chat frame names its host first', () => {
    expect(liveConfirmOf('btc.example.com')).toEqual({
      title: 'Add a live widget?',
      message: 'It loads from btc.example.com every minute while your Dashboard is open. That site sees your IP address, not your account.',
      confirmLabel: 'Add',
    });
  });

  test('every blocked link gets a hint', () => {
    expect(Object.keys(NODE_URL_HINTS).sort()).toEqual(['credentials', 'insecure', 'invalid', 'local']);
  });
});

describe('live widget snapshot', () => {
  test('the last good frame and its time round-trip, nothing else is kept', () => {
    const json = liveSnapshotJson({ ...shown, problem: 'timeout', failures: 4 });
    expect(json).toBe(JSON.stringify({ frame: { widget: CARD }, at: 1_000 }));
    expect(liveSnapshotOf(json)).toEqual(shown);
    expect(liveSnapshotJson(EMPTY_LIVE)).toBeNull();
  });

  test('missing or broken snapshots load as empty', () => {
    for (const raw of [null, '{', '7', JSON.stringify({ frame: { widget: CARD } }), JSON.stringify({ frame: { title: 'x' }, at: 1 })]) {
      expect(liveSnapshotOf(raw)).toEqual(EMPTY_LIVE);
    }
  });
});

describe('hosted nodes', () => {
  test('a widget owns the node its own key publishes, not one added by link', () => {
    const key = newNodeKey();
    const url = ownNodeUrl(key) ?? '';
    expect(url).toMatch(/^https:\/\/nodes\.stage\.box\/[0-9a-f]{32}$/);
    expect(ownsHostedNode({ url, key })).toBe(true);
    expect(ownsHostedNode({ url, key: newNodeKey() })).toBe(false);
    expect(ownsHostedNode({ url: 'https://btc.example.com/', key })).toBe(false);
  });

  test('publish problems read as one short line, with the code error when there is one', () => {
    expect(publishProblemText('not-ready')).toBe('Node hosting is not set up yet');
    expect(publishProblemText('too-large')).toBe('The code is over 64 KB');
    expect(publishProblemText('refused')).toBe('The code was refused');
    expect(publishProblemText('refused', 'Uncaught SyntaxError: Unexpected token')).toBe('Code error: Uncaught SyntaxError: Unexpected token');
  });

  test('a preview needs a loaded frame', () => {
    expect(livePreviewOf('https://n.example.com/', 'n.example.com', shown)).toEqual({ url: 'https://n.example.com/', host: 'n.example.com', frame: { widget: CARD }, state: shown });
    expect(livePreviewOf('https://n.example.com/', 'n.example.com', { ...EMPTY_LIVE, problem: 'status', status: 502 })).toBe('Could not load it: node error 502');
  });
});
