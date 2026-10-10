import { describe, expect, mock, test } from 'bun:test';
import {
  DASHBOARD_MAX_WIDGETS, dashboardSchema, EMPTY_DASHBOARD, liveSourceOf, type DashboardContent, type DashboardHeight,
  type DashboardWidget, type DashboardWidth,
} from '@stage-labs/client/xmtp/readState';
import {
  FRAME_ADD_TOASTS, HEIGHT_OPTIONS, WIDTH_OPTIONS, addFrameWidget, addLiveWidget, canAddWidget, cellRects, dropTarget, frameWidgetAdd,
  gridColumns, liveWidgetAdd, moveWidget, packWidgets, removedLiveIds, removeWidget, resizeWidget, widgetSpan,
} from '../components/dashboard/dashboard.model';
import { editDashboard, receiveDashboard } from '../lib/syncedSettings.model';

const values = new Map<string, string>();
const activeId = 'alice';
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
    delete: async (key: string): Promise<void> => { values.delete(key); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
const {
  addFrameToDashboard, addLiveToDashboard, applyRemoteDashboard, changeDashboard, loadDashboard, onDashboardChanged,
} = await import('../lib/dashboard');

const widget = (id: string, w: DashboardWidth = 'half', h: DashboardHeight = 1): DashboardWidget => ({
  id, w, h, kind: 'frame', source: { conversationId: 'conv0', messageId: id },
});
const ids = (widgets: readonly DashboardWidget[]): string[] => widgets.map(item => item.id);
const stored = (account: string): unknown => JSON.parse(values.get(`dashboard.v1.${account}`) ?? 'null');
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
const synced = (raw: unknown): DashboardContent => dashboardSchema.parse(JSON.parse(JSON.stringify(raw)));
const source = { conversationId: 'conv1', messageId: 'msg1' };
const frameWidget = (id: string, from = source): DashboardWidget => ({ id, w: 'half', h: 3, kind: 'frame', source: from });

describe('dashboard widgets', () => {
  test('a dashboard takes at most 48 widgets', () => {
    const full = Array.from({ length: DASHBOARD_MAX_WIDGETS }, (_, i) => widget(`w${i}`));
    expect(canAddWidget(full)).toBe(false);
    expect(canAddWidget(full.slice(1))).toBe(true);
  });

  test('removing drops only that widget and an unknown id changes nothing', () => {
    const list = [widget('a'), widget('b'), widget('c')];
    expect(ids(removeWidget(list, 'b'))).toEqual(['a', 'c']);
    expect(removeWidget(list, 'x')).toBe(list);
  });

  test('resizing changes width or height and ignores no-op sizes', () => {
    const list = [widget('a'), widget('b')];
    const wider = resizeWidget(list, 'a', { w: 'full' });
    expect(wider[0]).toEqual(widget('a', 'full', 1));
    expect(wider[1]).toBe(list[1]);
    expect(resizeWidget(wider, 'a', { h: 4 })[0]).toMatchObject({ w: 'full', h: 4 });
    expect(resizeWidget(list, 'a', { w: 'half', h: 1 })).toBe(list);
    expect(resizeWidget(list, 'x', { w: 'full' })).toBe(list);
  });

  test('a dropped widget takes the place of the widget it lands on, in both directions', () => {
    const list = ['a', 'b', 'c', 'd'].map(id => widget(id));
    expect(ids(moveWidget(list, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(moveWidget(list, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']);
    expect(moveWidget(list, 'b', 'b')).toBe(list);
    expect(moveWidget(list, 'x', 'b')).toBe(list);
    expect(moveWidget(list, 'b', 'x')).toBe(list);
  });

  test('the size menu names the widths and the heights in pixels', () => {
    expect(WIDTH_OPTIONS.map(option => option.label)).toEqual(['Full', 'Half', 'Quarter']);
    expect(HEIGHT_OPTIONS.map(option => option.label)).toEqual(['128\u00a0px', '256\u00a0px', '384\u00a0px', '512\u00a0px']);
  });
});

describe('frame widgets', () => {
  test('a frame widget keeps only its chat and message ids, 384 px high at the width asked', () => {
    expect(addFrameWidget([], 'f', source, 'half')).toEqual([frameWidget('f')]);
    expect(addFrameWidget([], 'f', source, 'full')).toEqual([{ ...frameWidget('f'), w: 'full' }]);
  });

  test('the same frame is added once, and never past the widget cap', () => {
    const list = addFrameWidget([widget('a')], 'f', source, 'half');
    expect(frameWidgetAdd(list, source)).toBe('exists');
    expect(addFrameWidget(list, 'g', source, 'half')).toBe(list);
    expect(addFrameWidget(list, 'f', { ...source, messageId: 'msg2' }, 'half')).toBe(list);
    expect(frameWidgetAdd(list, { ...source, messageId: 'msg2' })).toBe('added');
    expect(frameWidgetAdd(list, { ...source, conversationId: 'conv2' })).toBe('added');
    const full = Array.from({ length: DASHBOARD_MAX_WIDGETS }, (_, i) => widget(`w${i}`));
    expect(frameWidgetAdd(full, source)).toBe('full');
    expect(addFrameWidget(full, 'f', source, 'half')).toBe(full);
    expect(FRAME_ADD_TOASTS).toEqual({ added: 'Added to your dashboard', exists: 'Already on your dashboard', full: 'Your dashboard is full' });
  });

  test('only frame and live widgets are kept: no kind, another kind or a broken reference drops the widget', () => {
    const raw = {
      widgets: [
        { id: 'a', w: 'half', h: 1 }, { ...frameWidget('b'), kind: 'chart' }, { ...frameWidget('c'), kind: 7 },
        { ...frameWidget('d'), source: { conversationId: 'conv1' } }, { ...frameWidget('e'), source: 'conv1/msg1' },
        { ...frameWidget('f'), source: { conversationId: '', messageId: 'msg1' } }, frameWidget('g'),
      ],
      at: 4,
    };
    expect(synced(raw)).toEqual({ widgets: [frameWidget('g')], at: 4 });
  });

  test('frame widgets survive sync, moves and resizes, without fields this version does not write', () => {
    const extended = { ...source, screen: 'home' };
    const raw = { widgets: [{ ...frameWidget('f', extended), title: 'dropped' }, widget('e')], at: 4 };
    const list = synced(raw).widgets;
    expect(list).toEqual([frameWidget('f'), widget('e')]);
    expect(resizeWidget(moveWidget(list, 'e', 'f'), 'f', { w: 'full' })).toEqual([widget('e'), { ...frameWidget('f'), w: 'full' }]);
  });
});

describe('live widgets', () => {
  const live = { url: 'https://btc.example.com/', key: 'ab'.repeat(32) };
  const liveWidget = (id: string): DashboardWidget & { kind: 'live' } => ({
    id, w: 'half', h: 3, kind: 'live', source: { url: live.url }, key: live.key,
  });

  test('a live widget keeps its node url and its own key, 384 px high at the width asked', () => {
    expect(addLiveWidget([], 'l', live, 'half')).toEqual([liveWidget('l')]);
    expect(liveSourceOf(liveWidget('l'))).toEqual(live);
    expect(addLiveWidget([], 'l', live, 'full')).toEqual([{ ...liveWidget('l'), w: 'full' }]);
  });

  test('a live widget added from a chat remembers that frame', () => {
    const fromChat = { ...live, origin: source };
    const list = addLiveWidget([], 'l', fromChat, 'half');
    expect(list).toEqual([{ ...liveWidget('l'), origin: source }]);
    expect(liveSourceOf({ ...liveWidget('l'), origin: source })).toEqual(fromChat);
  });

  test('the same node url is added once, and never past the widget cap', () => {
    const list = addLiveWidget([widget('a')], 'l', live, 'half');
    expect(liveWidgetAdd(list, live.url)).toBe('exists');
    expect(addLiveWidget(list, 'm', { ...live, key: 'cd'.repeat(32) }, 'half')).toBe(list);
    expect(liveWidgetAdd(list, 'https://eth.example.com/')).toBe('added');
    const full = Array.from({ length: DASHBOARD_MAX_WIDGETS }, (_, i) => widget(`w${i}`));
    expect(liveWidgetAdd(full, live.url)).toBe('full');
    expect(addLiveWidget(full, 'l', live, 'half')).toBe(full);
  });

  test('a live widget without a valid url, key or origin is dropped', () => {
    const raw = {
      widgets: [
        { ...liveWidget('a'), key: 'short' }, { ...liveWidget('b'), key: 'AB'.repeat(32) }, { ...liveWidget('c'), source: { url: '' } },
        { ...liveWidget('d'), source: 'https://btc.example.com/' }, { ...liveWidget('e'), origin: { conversationId: '' } },
        { ...liveWidget('f'), origin: 'conv1' }, liveWidget('g'),
      ],
      at: 4,
    };
    expect(synced(raw)).toEqual({ widgets: [liveWidget('g')], at: 4 });
  });

  test('only live widgets that are gone count as removed', () => {
    const before = [liveWidget('l'), liveWidget('m'), frameWidget('f'), widget('e')];
    expect(removedLiveIds(before, [liveWidget('m')])).toEqual(['l']);
    expect(removedLiveIds(before, before)).toEqual([]);
    expect(removedLiveIds(before, [])).toEqual(['l', 'm']);
  });

  test('live widgets survive sync, moves and resizes with their key', () => {
    const raw = { widgets: [liveWidget('l'), frameWidget('f')], at: 4 };
    expect(synced(raw)).toEqual(raw);
    expect(resizeWidget(moveWidget(synced(raw).widgets, 'f', 'l'), 'l', { h: 4 })).toEqual([frameWidget('f'), { ...liveWidget('l'), h: 4 }]);
  });
});

describe('dashboard grid', () => {
  test('wide grids have 4 columns, phones have 2 where quarter shows as half and half as full', () => {
    expect(gridColumns(366)).toBe(2);
    expect(gridColumns(560)).toBe(4);
    expect([widgetSpan('full', 4), widgetSpan('half', 4), widgetSpan('quarter', 4)]).toEqual([4, 2, 1]);
    expect([widgetSpan('full', 2), widgetSpan('half', 2), widgetSpan('quarter', 2)]).toEqual([2, 2, 1]);
  });

  test('widgets fill the first free cells in order, so small widgets fill gaps next to tall ones', () => {
    const list = [widget('tall', 'half', 2), widget('q1', 'quarter'), widget('q2', 'quarter'), widget('q3', 'quarter'), widget('wide', 'full')];
    const layout = packWidgets(list, 4);
    expect(layout.cells.map(cell => [cell.col, cell.row])).toEqual([[0, 0], [2, 0], [3, 0], [2, 1], [0, 2]]);
    expect(layout.rows).toBe(3);
    expect(packWidgets([], 4)).toEqual({ columns: 4, rows: 0, cells: [] });
  });

  test('on 2 columns quarters pair up and halves take a full row', () => {
    const layout = packWidgets([widget('q1', 'quarter'), widget('h', 'half', 2), widget('q2', 'quarter')], 2);
    expect(layout.cells.map(cell => [cell.col, cell.row, cell.span])).toEqual([[0, 0, 1], [0, 1, 2], [1, 0, 1]]);
    expect(layout.rows).toBe(3);
  });

  test('cells become pixel rects of 128 px rows across the measured width', () => {
    const rects = cellRects(packWidgets([widget('a', 'half', 2), widget('b', 'quarter', 1)], 4), 800);
    expect(rects).toEqual([{ x: 0, y: 0, width: 400, height: 256 }, { x: 400, y: 0, width: 200, height: 128 }]);
  });

  test('the drop target is the widget under the pointer, else the nearest one', () => {
    const rects = cellRects(packWidgets([widget('a', 'half'), widget('b', 'half'), widget('c', 'full')], 4), 800);
    expect(dropTarget(rects, 500, 60, 0)).toBe(1);
    expect(dropTarget(rects, 100, 200, 0)).toBe(2);
    expect(dropTarget(rects, 700, 900, 0)).toBe(2);
    expect(dropTarget([], 10, 10, 3)).toBe(3);
  });
});

describe('dashboard sync state', () => {
  test('stored or synced layouts keep each current widget once, at most 48, and drop the rest', () => {
    const raw = {
      widgets: [
        widget('a'), widget('a', 'full', 2), { ...widget('b'), w: 'third' }, { ...widget('c'), h: 0 }, { ...widget('d'), h: 6 },
        { ...widget('e'), h: 1.5 }, { w: 'half', h: 1 }, 'nope', widget('f', 'quarter', 4),
      ],
      at: 5,
      theme: 'dropped',
    };
    expect(dashboardSchema.parse(raw)).toEqual({ widgets: [widget('a'), widget('f', 'quarter', 4)], at: 5 });
    const many = { widgets: Array.from({ length: DASHBOARD_MAX_WIDGETS + 5 }, (_, i) => widget(`w${i}`)), at: 1 };
    expect(ids(dashboardSchema.parse(many).widgets)).toEqual(ids(many.widgets.slice(0, DASHBOARD_MAX_WIDGETS)));
    expect(dashboardSchema.safeParse({ widgets: [] }).success).toBe(false);
    expect(dashboardSchema.safeParse({ widgets: 'x', at: 1 }).success).toBe(false);
  });

  test('a local edit advances the clock and a no-op edit keeps the state', () => {
    const current: DashboardContent = { widgets: [widget('a')], at: 50 };
    expect(editDashboard(current, current.widgets, 10)).toBe(current);
    expect(editDashboard(current, [], 10)).toEqual({ widgets: [], at: 51 });
    expect(editDashboard(current, [], 99)).toEqual({ widgets: [], at: 99 });
  });

  test('the newest layout wins whichever device sent it', () => {
    const local: DashboardContent = { widgets: [widget('a')], at: 50 };
    const newer: DashboardContent = { widgets: [widget('b')], at: 60 };
    expect(receiveDashboard(local, newer)).toBe(newer);
    expect(receiveDashboard(newer, local)).toBe(newer);
    expect(receiveDashboard(local, { ...newer, at: 50 })).toBe(local);
  });
});

describe('dashboard store', () => {
  test('edits are saved per account under a versioned key and announced for sync', async () => {
    const sent: DashboardContent[] = [];
    const stop = onDashboardChanged(change => { sent.push(change.state); });
    expect(await loadDashboard('alice')).toBeNull();
    changeDashboard(list => [...list, widget('a')]);
    changeDashboard(list => resizeWidget(list, 'a', { w: 'full', h: 2 }));
    changeDashboard(list => removeWidget(list, 'missing'));
    await settle();
    expect(stored('alice')).toMatchObject({ widgets: [widget('a', 'full', 2)] });
    expect(sent.map(state => state.widgets)).toEqual([[widget('a')], [widget('a', 'full', 2)]]);
    expect(await loadDashboard('alice')).toMatchObject({ widgets: [widget('a', 'full', 2)] });
    expect(await loadDashboard('bob')).toBeNull();
    stop();
  });

  test('a remote layout applies only when newer, for the account it belongs to', async () => {
    const before = await loadDashboard('alice');
    if (before === null) throw new Error('Missing local dashboard');
    await applyRemoteDashboard('alice', { widgets: [widget('old')], at: before.at - 1 });
    expect(stored('alice')).toEqual(before);
    await applyRemoteDashboard('alice', { widgets: [widget('new', 'quarter', 3)], at: before.at + 1 });
    expect(stored('alice')).toEqual({ widgets: [widget('new', 'quarter', 3)], at: before.at + 1 });
    await applyRemoteDashboard('carol', { widgets: [widget('c')], at: 7 });
    expect(stored('carol')).toEqual({ widgets: [widget('c')], at: 7 });
  });

  test('adding a frame saves a frame widget once and announces it for sync', async () => {
    const sent: DashboardContent[] = [];
    const stop = onDashboardChanged(change => { sent.push(change.state); });
    expect(await addFrameToDashboard(source, 'full')).toBe('added');
    expect(await addFrameToDashboard(source, 'half')).toBe('exists');
    await settle();
    const saved = await loadDashboard('alice');
    const added = saved?.widgets.at(-1);
    expect(added).toMatchObject({ w: 'full', h: 3, kind: 'frame', source });
    expect(added?.id).toMatch(/^[0-9a-f]{16}$/);
    expect(stored('alice')).toEqual(saved);
    expect(sent).toHaveLength(1);
    stop();
  });

  test('adding a live widget saves it once with its key and announces it for sync', async () => {
    const sent: DashboardContent[] = [];
    const stop = onDashboardChanged(change => { sent.push(change.state); });
    const live = { url: 'https://btc.example.com/', key: 'ef'.repeat(32) };
    const first = await addLiveToDashboard(live, 'half');
    expect(first.outcome).toBe('added');
    expect((await addLiveToDashboard({ ...live, key: '01'.repeat(32) }, 'full')).outcome).toBe('exists');
    await settle();
    const added = (await loadDashboard('alice'))?.widgets.find(item => item.id === first.id);
    expect(added).toEqual({ id: first.id, w: 'half', h: 3, kind: 'live', source: { url: live.url }, key: live.key });
    expect(sent).toHaveLength(1);
    stop();
  });

  test('removing a live widget here or on another device drops its saved frame', async () => {
    const one = await addLiveToDashboard({ url: 'https://one.example.com/', key: 'aa'.repeat(32) }, 'half');
    const two = await addLiveToDashboard({ url: 'https://two.example.com/', key: 'bb'.repeat(32) }, 'half');
    values.set(`liveFrame.v1.alice.${one.id}`, '{}');
    values.set(`liveFrame.v1.alice.${two.id}`, '{}');
    changeDashboard(widgets => removeWidget(widgets, one.id));
    await settle();
    expect(values.has(`liveFrame.v1.alice.${one.id}`)).toBe(false);
    expect(values.has(`liveFrame.v1.alice.${two.id}`)).toBe(true);
    const current = (await loadDashboard('alice'))?.widgets ?? [];
    await applyRemoteDashboard('alice', { widgets: current.filter(item => item.id !== two.id), at: Date.now() + 60_000 });
    await settle();
    expect(values.has(`liveFrame.v1.alice.${two.id}`)).toBe(false);
  });

  test('missing or broken saved data loads as an empty dashboard', async () => {
    values.set('dashboard.v1.dave', '{not json');
    values.set('dashboard.v1.erin', JSON.stringify({ widgets: [{ id: '', w: 'half', h: 1 }, { w: 'half', h: 1 }, 7], at: 3 }));
    expect(await loadDashboard('dave')).toBeNull();
    expect(await loadDashboard('erin')).toEqual({ widgets: [], at: 3 });
    expect(EMPTY_DASHBOARD).toEqual({ widgets: [], at: 0 });
  });
});
