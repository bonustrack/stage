/**
 * @file Table — a hook-free ChatKit-styled data table with attached `Table.Row`/`Table.Cell` subcomponents, laid out as flex rows where `width` fixes a cell and `colSpan` adds flex weight.
 */

import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

export type TableCellAlign = 'start' | 'center' | 'end';

const H_ALIGN: Record<TableCellAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

const V_JUSTIFY: Record<TableCellAlign, ViewStyle['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

export interface TableCellProps {
  /** ChatKit: children. Cell content (typically a Kit Text/Label node). */
  children?: ReactNode;
  /** ChatKit: width. Fixed cell width (px or %). Omit to flex-share. */
  width?: number | string;
  /** ChatKit: padding. Uniform px padding. Default 8. */
  padding?: number;
  /** ChatKit: colSpan. Columns to span (adds flex weight). Default 1. */
  colSpan?: number;
  /** ChatKit: rowSpan. Parity only (flat flex rows can't span vertically). */
  rowSpan?: number;
  /** ChatKit: align. Horizontal alignment. Default 'start'. */
  align?: TableCellAlign;
  /** ChatKit: vAlign. Vertical alignment. Default 'center'. */
  vAlign?: TableCellAlign;
  /** ChatKit: colSize. Parity only. */
  colSize?: 'auto' | 'fit' | number;
  /** Escape-hatch style merged onto the cell. */
  style?: ViewStyle;
}

/** ChatKit `Table.Cell`. Rendered by the parent Row (it reads these props off the element); standalone render is a styled box for safety. */
function TableCell(props: TableCellProps): React.ReactElement {
  const { children, width, padding = 8, colSpan = 1, align = 'start', vAlign = 'center', style } = props;
  const base: ViewStyle = {
    width: width as ViewStyle['width'],
    flex: width === undefined ? colSpan : undefined,
    padding,
    alignItems: H_ALIGN[align],
    justifyContent: V_JUSTIFY[vAlign],
  };
  return <View style={style ? [base, style] : base}>{children}</View>;
}

export interface TableRowProps {
  /** ChatKit: children. The row's `Table.Cell`s. */
  children?: ReactNode;
  /** ChatKit: header. Marks the row as a header (tinted + bottom border). */
  header?: boolean;
  /** Effective color scheme. */
  dark?: boolean;
  /** Escape-hatch style merged onto the row. */
  style?: ViewStyle;
}

/** ChatKit `Table.Row`. Lays its `Table.Cell` children out as a flex row. */
function TableRow(props: TableRowProps): React.ReactElement {
  const { children, header, dark = false, style } = props;
  const border = dark ? '#282a2d' : '#e4e4e5';
  const headerBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const base: ViewStyle = {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: border,
    backgroundColor: header ? headerBg : undefined,
  };
  return <View style={style ? [base, style] : base}>{children}</View>;
}

export interface TableProps {
  /** ChatKit: children. The table's `Table.Row`s. */
  children?: ReactNode;
  /** Effective color scheme. */
  dark?: boolean;
  /** Escape-hatch style merged onto the table container. */
  style?: ViewStyle;
}

interface TableComponent {
  (props: TableProps): React.ReactElement;
  Row: typeof TableRow;
  Cell: typeof TableCell;
}

/** ChatKit-style RN table. Wraps rows in a bordered container and threads `dark` into each `Table.Row` so the hairlines track the scheme. */
const TableBase = (props: TableProps): React.ReactElement => {
  const { children, dark = false, style } = props;
  const border = dark ? '#282a2d' : '#e4e4e5';
  const base: ViewStyle = {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 8,
    overflow: 'hidden',
  };
  const rows = Children.map(children, (child) => {
    if (isValidElement<TableRowProps>(child) && child.type === TableRow) {
      return child.props.dark === undefined ? cloneElement(child, { dark }) : child;
    }
    return child;
  });
  return <View style={style ? [base, style] : base}>{rows}</View>;
};

export const Table = Object.assign(TableBase, { Row: TableRow, Cell: TableCell }) as TableComponent;
export { TableRow, TableCell };
