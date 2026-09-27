import { stepRow, type Arrow } from '../arrowKeys.model';

interface NavColumn {
  key: string;
  rows: readonly { convId: string }[];
}

export interface BoardCardRef {
  key: string;
  convId: string;
}

function sideways(columns: readonly NavColumn[], from: number, step: number, row: number): BoardCardRef | null {
  for (let index = from + step; index >= 0 && index < columns.length; index += step) {
    const column = columns[index];
    const card = column?.rows[Math.min(row, column.rows.length - 1)];
    if (column !== undefined && card !== undefined) return { key: column.key, convId: card.convId };
  }
  return null;
}

export function boardArrowMove(
  columns: readonly NavColumn[], columnIndex: number, convId: string | null, arrow: Arrow,
): BoardCardRef | null {
  const column = columns[columnIndex];
  const row = column?.rows.findIndex(r => r.convId === convId) ?? -1;
  if (column === undefined || row === -1) return null;
  if (arrow === 'ArrowLeft' || arrow === 'ArrowRight') {
    return sideways(columns, columnIndex, arrow === 'ArrowLeft' ? -1 : 1, row);
  }
  const card = stepRow(column.rows, convId, arrow);
  return card === null ? null : { key: column.key, convId: card.convId };
}
