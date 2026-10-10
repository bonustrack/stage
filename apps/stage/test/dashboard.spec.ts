import { describe, expect, mock, test } from 'bun:test';
import {
  DASHBOARD_MAX_WIDGETS, dashboardSchema, EMPTY_DASHBOARD, frameSourceOf, liveSourceOf, type DashboardContent, type DashboardWidget,
} from '@stage-labs/client/xmtp/readState';
import {
  FRAME_ADD_TOASTS, addFrameWidget, addLiveWidget, canAddWidget, cellRects, dropTarget, frameWidgetAdd, gridColumns, liveWidgetAdd,
  moveWidget, packWidgets, removeWidget, resizeWidget, widgetHeight, widgetKindOf, widgetSizeLabel, widgetSpan, widgetWidth,
} from '../components/dashboard/dashboard.model';
import { editDashboard, receiveDashboard } from '../lib/syncedSettings.model';

const values = new Map<string, string>();
const activeId = 'alice';
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
const {
  addFrameToDashboard, addLiveToDashboard, applyRemoteDashboard, changeDashboard, loadDashboard, onDashboardChanged,
} = await import('../lib/dashboard');

const widget = (id: string, w = 'half', h = 1): DashboardWidget => ({ id, w, h });
const ids = (widgets: readonly DashboardWidget[]): string[] => widgets.map(item => item.id);
const stored = (account: string): unknown => JSON.parse(values.get(`dashboard.v1.${account}`) ?? 'null');
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
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

  test('resizing changes width or height, keeps unknown fields and ignores no-op sizes', () => {
    const list: DashboardWidget[] = [{ ...widget('a'), content: { kind: 'later' } }, widget('b')];
    const wider = resizeWidget(list, 'a', { w: 'full' });
    expect(wider[0]).toEqual({ id: 'a', w: 'full', h: 1, content: { kind: 'later' } });
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

  test('the size label names the width and the height in pixels', () => {
    expect(widgetSizeLabel(widget('a', 'quarter', 3))).toBe('Quarter width · 384\u00a0px');
  });

  test('sizes this version does not know show as half width and at most 512 px, and keep their stored value', () => {
    const odd = widget('x', 'third', 6);
    expect([widgetWidth(odd), widgetHeight(odd)]).toEqual(['half', 4]);
    expect(widgetSizeLabel(odd)).toBe('Half width · 512\u00a0px');
    expect(packWidgets([odd], 4).cells).toEqual([{ col: 0, row: 0, span: 2, rows: 4 }]);
    expect(resizeWidget([odd], 'x', { w: 'quarter' })).toEqual([widget('x', 'quarter', 6)]);
  });
});

describe('frame widgets', () => {
  test('a frame widget keeps only its chat and message ids, half width and 384 px unless asked wider', () => {
    const list = addFrameWidget([], 'f', source);
    expect(list).toEqual([frameWidget('f')]);
    expect(list.map(item => [widgetKindOf(item), frameSourceOf(item), widgetSizeLabel(item)]))
      .toEqual([['frame', source, 'Half width · 384\u00a0px']]);
    expect(addFrameWidget([], 'f', source, 'full')).toEqual([{ ...frameWidget('f'), w: 'full' }]);
  });

  test('the same frame is added once, and never past the widget cap', () => {
    const list = addFrameWidget([widget('a')], 'f', source);
    expect(frameWidgetAdd(list, source)).toBe('exists');
    expect(addFrameWidget(list, 'g', source)).toBe(list);
    expect(addFrameWidget(list, 'f', { ...source, messageId: 'msg2' })).toBe(list);
    expect(frameWidgetAdd(list, { ...source, messageId: 'msg2' })).toBe('added');
    expect(frameWidgetAdd(list, { ...source, conversationId: 'conv2' })).toBe('added');
    const full = Array.from({ length: DASHBOARD_MAX_WIDGETS }, (_, i) => widget(`w${i}`));
    expect(frameWidgetAdd(full, source)).toBe('full');
    expect(addFrameWidget(full, 'f', source)).toBe(full);
    expect(FRAME_ADD_TOASTS).toEqual({ added: 'Added to your dashboard', exists: 'Already on your dashboard', full: 'Your dashboard is full' });
  });

  test('a widget without a kind is empty, and a kind this version does not know is unsupported', () => {
    expect(widgetKindOf(widget('a'))).toBe('empty');
    expect(widgetKindOf({ ...widget('b'), kind: 'chart' })).toBe('unsupported');
    expect(widgetKindOf({ ...widget('c'), kind: 7 })).toBe('unsupported');
  });

  test('a frame widget with a broken reference has no source, and extra reference fields are not read', () => {
    expect(frameSourceOf({ ...frameWidget('a'), source: { conversationId: 'conv1' } })).toBeNull();
    expect(frameSourceOf({ ...frameWidget('b'), source: 'conv1/msg1' })).toBeNull();
    expect(frameSourceOf({ ...frameWidget('c'), source: { conversationId: '', messageId: 'msg1' } })).toBeNull();
    expect(frameSourceOf({ ...frameWidget('d'), kind: 'chart' })).toBeNull();
    expect(frameSourceOf(widget('e'))).toBeNull();
    const extended = { ...source, screen: 'home' };
    expect(frameSourceOf(frameWidget('f', extended))).toEqual(source);
  });

  test('frame widgets and kinds this version does not know survive sync, moves and resizes untouched', () => {
    const later = { id: 'x', w: 'half', h: 2, kind: 'chart', source: { query: 'q' }, title: 'kept' };
    const raw = { widgets: [frameWidget('f'), later, widget('e')], at: 4 };
    const synced = dashboardSchema.parse(JSON.parse(JSON.stringify(raw)));
    expect(synced).toEqual(raw);
    const edited = resizeWidget(moveWidget(synced.widgets, 'e', 'f'), 'f', { w: 'full' });
    expect(edited).toEqual([widget('e'), { ...frameWidget('f'), w: 'full' }, later]);
  });
});

describe('live widgets', () => {
  const live = { url: 'https://btc.example.com/', key: 'ab'.repeat(32) };
  const liveWidget = (id: string): DashboardWidget => ({ id, w: 'half', h: 3, kind: 'live', source: { url: live.url }, key: live.key });

  test('a live widget keeps its node url and its own key, half width and 384 px unless asked wider', () => {
    const list = addLiveWidget([], 'l', live);
    expect(list).toEqual([liveWidget('l')]);
    expect(list.map(item => [widgetKindOf(item), liveSourceOf(item), frameSourceOf(item)])).toEqual([['live', live, null]]);
    expect(addLiveWidget([], 'l', live, 'full')).toEqual([{ ...liveWidget('l'), w: 'full' }]);
  });

  test('the same node url is added once, and never past the widget cap', () => {
    const list = addLiveWidget([widget('a')], 'l', live);
    expect(liveWidgetAdd(list, live.url)).toBe('exists');
    expect(addLiveWidget(list, 'm', { ...live, key: 'cd'.repeat(32) })).toBe(list);
    expect(liveWidgetAdd(list, 'https://eth.example.com/')).toBe('added');
    const full = Array.from({ length: DASHBOARD_MAX_WIDGETS }, (_, i) => widget(`w${i}`));
    expect(liveWidgetAdd(full, live.url)).toBe('full');
    expect(addLiveWidget(full, 'l', live)).toBe(full);
  });

  test('a live widget without a valid url or key shows as unsupported', () => {
    expect(widgetKindOf({ ...liveWidget('a'), key: 'short' })).toBe('unsupported');
    expect(widgetKindOf({ ...liveWidget('b'), key: 'AB'.repeat(32) })).toBe('unsupported');
    expect(widgetKindOf({ ...liveWidget('c'), source: { url: '' } })).toBe('unsupported');
    expect(widgetKindOf({ ...liveWidget('d'), source: 'https://btc.example.com/' })).toBe('unsupported');
    expect(liveSourceOf({ ...liveWidget('e'), kind: 'frame' })).toBeNull();
  });

  test('live widgets survive sync, moves and resizes with their key', () => {
    const raw = { widgets: [liveWidget('l'), frameWidget('f')], at: 4 };
    const synced = dashboardSchema.parse(JSON.parse(JSON.stringify(raw)));
    expect(synced).toEqual(raw);
    expect(resizeWidget(moveWidget(synced.widgets, 'f', 'l'), 'l', { h: 4 })).toEqual([frameWidget('f'), { ...liveWidget('l'), h: 4 }]);
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
  test('stored or synced layouts keep each widget with an id once, with unknown sizes and fields intact', () => {
    const raw = {
      widgets: [
        widget('a'), { id: 'a', w: 'full', h: 2 }, { id: 'b', w: 'third', h: 1 }, { id: 'c', w: 'half', h: 0 },
        { w: 'half', h: 1 }, 'nope', { id: 'd', w: 'quarter', h: 4, title: 'kept' },
      ],
      at: 5,
      theme: 'later',
    };
    expect(dashboardSchema.parse(raw)).toEqual({
      widgets: [widget('a'), widget('b', 'third', 1), { id: 'd', w: 'quarter', h: 4, title: 'kept' }], at: 5, theme: 'later',
    });
    const many = { widgets: Array.from({ length: DASHBOARD_MAX_WIDGETS + 5 }, (_, i) => widget(`w${i}`)), at: 1 };
    expect(dashboardSchema.parse(many).widgets).toHaveLength(DASHBOARD_MAX_WIDGETS + 5);
    expect(dashboardSchema.safeParse({ widgets: [] }).success).toBe(false);
    expect(dashboardSchema.safeParse({ widgets: 'x', at: 1 }).success).toBe(false);
  });

  test('a local edit advances the clock and a no-op edit keeps the state', () => {
    const current: DashboardContent = { widgets: [widget('a')], at: 50 };
    expect(editDashboard(current, current.widgets, 10)).toBe(current);
    expect(editDashboard(current, [], 10)).toEqual({ widgets: [], at: 51 });
    expect(editDashboard(current, [], 99)).toEqual({ widgets: [], at: 99 });
    expect(editDashboard({ ...current, theme: 'later' }, [], 99)).toEqual({ widgets: [], at: 99, theme: 'later' });
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

  test('missing or broken saved data loads as an empty dashboard', async () => {
    values.set('dashboard.v1.dave', '{not json');
    values.set('dashboard.v1.erin', JSON.stringify({ widgets: [{ id: '', w: 'half', h: 1 }, { w: 'half', h: 1 }, 7], at: 3 }));
    expect(await loadDashboard('dave')).toBeNull();
    expect(await loadDashboard('erin')).toEqual({ widgets: [], at: 3 });
    expect(EMPTY_DASHBOARD).toEqual({ widgets: [], at: 0 });
  });
});
