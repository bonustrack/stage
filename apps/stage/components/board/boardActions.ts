import { setBoardOrder } from '../../lib/boardOrder';
import { lineOfConv, moveGroupLabel } from '../../modules/messaging';
import { toastLabelError } from '../group/group.labels';
import {
  columnLabel, keptColumnOrder, movedColumnOrder, removedColumnOrder, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';

export function dropOnBoard(
  columns: readonly BoardColumn<unknown>[], saved: readonly string[], drag: BoardDrag, key: string,
): void {
  if (drag.kind === 'column') {
    const next = movedColumnOrder(columns.map(column => column.key), saved, drag.key, key);
    if (next !== null) setBoardOrder(next);
    return;
  }
  const kept = keptColumnOrder(columns, saved, drag.from);
  if (kept !== null) setBoardOrder(kept);
  const from = columnLabel(columns, drag.from);
  void moveGroupLabel(lineOfConv(drag.convId), from, columnLabel(columns, key)).catch(toastLabelError);
}

export function removeBoardColumn(saved: readonly string[], key: string): void {
  setBoardOrder(removedColumnOrder(saved, key));
}
