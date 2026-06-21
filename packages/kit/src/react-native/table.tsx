
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
  children?: ReactNode;
  width?: number | string;
  padding?: number;
  colSpan?: number;
  rowSpan?: number;
  align?: TableCellAlign;
  vAlign?: TableCellAlign;
  colSize?: 'auto' | 'fit' | number;
  style?: ViewStyle;
}

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
  children?: ReactNode;
  header?: boolean;
  dark?: boolean;
  style?: ViewStyle;
}

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
  children?: ReactNode;
  dark?: boolean;
  style?: ViewStyle;
}

interface TableComponent {
  (props: TableProps): React.ReactElement;
  Row: typeof TableRow;
  Cell: typeof TableCell;
}

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
