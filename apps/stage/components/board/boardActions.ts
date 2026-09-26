import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { setBoardOrder } from '../../lib/boardOrder';
import { capabilities } from '../../lib/capabilities';
import { LabelPermissionError, lineOfConv, moveGroupLabel, renameGroupLabel } from '../../modules/messaging';
import { toastLabelError } from '../group/group.labels';
import {
  columnLabel, keptColumnOrder, labelCarriers, movedColumnOrder, renamedColumnOrder, renameTarget,
  type BoardColumn, type BoardDrag,
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

function renameOutcome(results: readonly PromiseSettledResult<unknown>[]): string | null {
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const refused = failed.filter(r => r.reason instanceof LabelPermissionError).length;
  if (failed.length > refused) return 'Could not rename the label in every group. Try again.';
  if (refused === 0) return null;
  return refused === 1
    ? '1 group kept the old name, no permission to edit its labels.'
    : `${refused} groups kept the old name, no permission to edit their labels.`;
}

export async function renameBoardLabel(
  rows: readonly ChannelListRow[], columns: readonly BoardColumn<unknown>[], saved: readonly string[],
  from: string, name: string,
): Promise<void> {
  const to = renameTarget(columns, from, name).name;
  setBoardOrder(renamedColumnOrder(columns.map(c => c.key), saved, from, to));
  const results = await Promise.allSettled(
    labelCarriers(rows, from).map(convId => renameGroupLabel(lineOfConv(convId), from, to)),
  );
  const outcome = renameOutcome(results);
  if (outcome !== null) capabilities.toast(outcome);
}
