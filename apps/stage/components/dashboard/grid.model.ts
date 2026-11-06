import { DASHBOARD_HEIGHTS, DASHBOARD_WIDTHS, type DashboardWidget, type DashboardWidth } from '@stage-labs/client/xmtp/sync/dashboard';

export const DASHBOARD_ROW = 128;
export const DASHBOARD_GAP = 12;
const WIDE_GRID_MIN = 560;
const SPAN: Readonly<Record<DashboardWidth, number>> = { full: 4, half: 2, quarter: 1 };
const WIDTH_LABEL: Readonly<Record<DashboardWidth, string>> = { full: 'Full', half: 'Half', quarter: 'Quarter' };

function heightLabel(h: number): string {
  return `${h * DASHBOARD_ROW}\u00a0px`;
}

export const WIDTH_OPTIONS = DASHBOARD_WIDTHS.map((value) => ({ value, label: WIDTH_LABEL[value] }));
export const HEIGHT_OPTIONS = DASHBOARD_HEIGHTS.map((value) => ({ value, label: heightLabel(value) }));

export function gridColumns(width: number): number {
  return width >= WIDE_GRID_MIN ? 4 : 2;
}

export function widgetSpan(width: DashboardWidth, columns: number): number {
  return Math.min(SPAN[width], columns);
}

export interface WidgetCell {
  col: number;
  row: number;
  span: number;
  rows: number;
}

export interface GridLayout {
  columns: number;
  rows: number;
  cells: WidgetCell[];
}

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
    const cell = firstFit(taken, widgetSpan(widget.w, columns), widget.h, columns);
    occupy(taken, cell);
    return cell;
  });
  return { columns, rows: taken.length, cells };
}

export interface WidgetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cellRects(layout: GridLayout, width: number): WidgetRect[] {
  const column = width / layout.columns;
  return layout.cells.map((cell) => ({
    x: cell.col * column,
    y: cell.row * DASHBOARD_ROW,
    width: cell.span * column,
    height: cell.rows * DASHBOARD_ROW,
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
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  return nearest;
}
