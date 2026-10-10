import {
  DASHBOARD_FRAME_KIND, DASHBOARD_HEIGHTS, DASHBOARD_LIVE_KIND, DASHBOARD_MAX_WIDGETS, DASHBOARD_WIDTHS, frameSourceOf, liveSourceOf,
  type DashboardHeight, type DashboardSource, type DashboardWidget, type DashboardWidth, type LiveSource,
} from '@stage-labs/client/xmtp/readState';

export const DASHBOARD_ROW = 128;
export const DASHBOARD_GAP = 12;
const WIDE_GRID_MIN = 560;
const SPAN: Readonly<Record<DashboardWidth, number>> = { full: 4, half: 2, quarter: 1 };
const WIDTH_LABEL: Readonly<Record<DashboardWidth, string>> = { full: 'Full', half: 'Half', quarter: 'Quarter' };

const FALLBACK_WIDTH: DashboardWidth = 'half';
const MAX_HEIGHT = DASHBOARD_HEIGHTS.length;

interface WidgetSize { w?: DashboardWidth; h?: DashboardHeight }

function heightLabel(h: number): string {
  return `${h * DASHBOARD_ROW}\u00a0px`;
}

export const WIDTH_OPTIONS = DASHBOARD_WIDTHS.map(value => ({ value, label: WIDTH_LABEL[value] }));
export const HEIGHT_OPTIONS = DASHBOARD_HEIGHTS.map(value => ({ value, label: heightLabel(value) }));

export function widgetWidth(widget: DashboardWidget): DashboardWidth {
  return DASHBOARD_WIDTHS.find(width => width === widget.w) ?? FALLBACK_WIDTH;
}

export function widgetHeight(widget: DashboardWidget): number {
  return Math.min(Math.max(widget.h, 1), MAX_HEIGHT);
}

export function widgetSizeLabel(widget: DashboardWidget): string {
  return `${WIDTH_LABEL[widgetWidth(widget)]} width · ${heightLabel(widgetHeight(widget))}`;
}

export function canAddWidget(widgets: readonly DashboardWidget[]): boolean {
  return widgets.length < DASHBOARD_MAX_WIDGETS;
}

export const FRAME_WIDGET_HEIGHT: DashboardHeight = 3;

export type WidgetKind = 'empty' | 'frame' | 'live' | 'unsupported';

export function widgetKindOf(widget: DashboardWidget): WidgetKind {
  if (widget.kind === undefined) return 'empty';
  if (widget.kind === DASHBOARD_FRAME_KIND) return 'frame';
  return liveSourceOf(widget) === null ? 'unsupported' : 'live';
}

export type FrameWidgetAdd = 'added' | 'exists' | 'full';

export const FRAME_ADD_TOASTS: Readonly<Record<FrameWidgetAdd, string>> = {
  added: 'Added to your dashboard',
  exists: 'Already on your dashboard',
  full: 'Your dashboard is full',
};

function sameSource(widget: DashboardWidget, source: DashboardSource): boolean {
  const own = frameSourceOf(widget);
  return own !== null && own.conversationId === source.conversationId && own.messageId === source.messageId;
}

export function frameWidgetAdd(widgets: readonly DashboardWidget[], source: DashboardSource): FrameWidgetAdd {
  if (widgets.some(widget => sameSource(widget, source))) return 'exists';
  return canAddWidget(widgets) ? 'added' : 'full';
}

export function addFrameWidget(
  widgets: DashboardWidget[], id: string, source: DashboardSource, w: DashboardWidth = FALLBACK_WIDTH,
): DashboardWidget[] {
  if (frameWidgetAdd(widgets, source) !== 'added' || widgets.some(widget => widget.id === id)) return widgets;
  return [...widgets, { id, w, h: FRAME_WIDGET_HEIGHT, kind: DASHBOARD_FRAME_KIND, source }];
}

export function liveWidgetAdd(widgets: readonly DashboardWidget[], url: string): FrameWidgetAdd {
  if (widgets.some(widget => liveSourceOf(widget)?.url === url)) return 'exists';
  return canAddWidget(widgets) ? 'added' : 'full';
}

export function addLiveWidget(
  widgets: DashboardWidget[], id: string, source: LiveSource, w: DashboardWidth = FALLBACK_WIDTH,
): DashboardWidget[] {
  if (liveWidgetAdd(widgets, source.url) !== 'added' || widgets.some(widget => widget.id === id)) return widgets;
  const widget: DashboardWidget = { id, w, h: FRAME_WIDGET_HEIGHT, kind: DASHBOARD_LIVE_KIND, source: { url: source.url }, key: source.key };
  return [...widgets, source.origin === undefined ? widget : { ...widget, origin: source.origin }];
}

export function removedLiveIds(before: readonly DashboardWidget[], after: readonly DashboardWidget[]): string[] {
  const kept = new Set(after.map(widget => widget.id));
  return before.filter(widget => widget.kind === DASHBOARD_LIVE_KIND && !kept.has(widget.id)).map(widget => widget.id);
}

export function removeWidget(widgets: DashboardWidget[], id: string): DashboardWidget[] {
  const next = widgets.filter(widget => widget.id !== id);
  return next.length === widgets.length ? widgets : next;
}

export function resizeWidget(widgets: DashboardWidget[], id: string, size: WidgetSize): DashboardWidget[] {
  const index = widgets.findIndex(widget => widget.id === id);
  const current = widgets[index];
  if (current === undefined) return widgets;
  const next = { ...current, ...size };
  if (next.w === current.w && next.h === current.h) return widgets;
  return widgets.map((widget, i) => (i === index ? next : widget));
}

export function moveWidget(widgets: DashboardWidget[], id: string, targetId: string): DashboardWidget[] {
  const from = widgets.findIndex(widget => widget.id === id);
  const to = widgets.findIndex(widget => widget.id === targetId);
  const moved = widgets[from];
  if (moved === undefined || to === -1 || from === to) return widgets;
  const next = widgets.filter((_, i) => i !== from);
  next.splice(to, 0, moved);
  return next;
}

export function gridColumns(width: number): number {
  return width >= WIDE_GRID_MIN ? 4 : 2;
}

export function widgetSpan(width: DashboardWidth, columns: number): number {
  return Math.min(SPAN[width], columns);
}

export interface WidgetCell { col: number; row: number; span: number; rows: number }

export interface GridLayout { columns: number; rows: number; cells: WidgetCell[] }

function isFree(taken: readonly boolean[][], cell: WidgetCell): boolean {
  for (let row = cell.row; row < cell.row + cell.rows; row++) {
    for (let col = cell.col; col < cell.col + cell.span; col++) {
      if (taken[row]?.[col] === true) return false;
    }
  }
  return true;
}

function occupy(taken: boolean[][], cell: WidgetCell): void {
  for (let row = cell.row; row < cell.row + cell.rows; row++) {
    const line = taken[row] ?? [];
    for (let col = cell.col; col < cell.col + cell.span; col++) line[col] = true;
    taken[row] = line;
  }
}

function firstFit(taken: readonly boolean[][], span: number, rows: number, columns: number): WidgetCell {
  for (let row = 0; row < taken.length; row++) {
    for (let col = 0; col + span <= columns; col++) {
      const cell = { col, row, span, rows };
      if (isFree(taken, cell)) return cell;
    }
  }
  return { col: 0, row: taken.length, span, rows };
}

export function packWidgets(widgets: readonly DashboardWidget[], columns: number): GridLayout {
  const taken: boolean[][] = [];
  const cells = widgets.map((widget) => {
    const cell = firstFit(taken, widgetSpan(widgetWidth(widget), columns), widgetHeight(widget), columns);
    occupy(taken, cell);
    return cell;
  });
  return { columns, rows: taken.length, cells };
}

export interface WidgetRect { x: number; y: number; width: number; height: number }

export function cellRects(layout: GridLayout, width: number): WidgetRect[] {
  const column = width / layout.columns;
  return layout.cells.map(cell => ({
    x: cell.col * column, y: cell.row * DASHBOARD_ROW, width: cell.span * column, height: cell.rows * DASHBOARD_ROW,
  }));
}

function contains(rect: WidgetRect, x: number, y: number): boolean {
  'worklet';
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function distance(rect: WidgetRect, x: number, y: number): number {
  'worklet';
  return Math.hypot(rect.x + rect.width / 2 - x, rect.y + rect.height / 2 - y);
}

export function dropTarget(rects: readonly WidgetRect[], x: number, y: number, from: number): number {
  'worklet';
  let nearest = from;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (rect === undefined) continue;
    if (contains(rect, x, y)) return i;
    const d = distance(rect, x, y);
    if (d < best) { best = d; nearest = i; }
  }
  return nearest;
}
