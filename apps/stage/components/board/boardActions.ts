import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { labelNames, type LabelEntry } from '@stage-labs/client/xmtp/labelRegistry';
import { setBoardOrder } from '../../lib/boardOrder';
import { capabilities } from '../../lib/capabilities';
import { renameLabelEntry } from '../../lib/labelRegistry';
import { LabelPermissionError, lineOfConv, moveGroupLabel, renameGroupLabel } from '../../modules/messaging';
import { toastLabelError } from '../group/group.labels';
import {
  cardLabel, columnLabel, keptColumnOrder, labelCarriers, movedColumnOrder, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';

export function dropOnBoard(
  columns: readonly BoardColumn<ChannelListRow>[], saved: readonly string[], drag: BoardDrag, key: string,
): void {
  if (drag.kind === 'column') {
    const next = movedColumnOrder(columns.map(column => column.key), saved, drag.key, key);
    if (next !== null) setBoardOrder(next);
    return;
  }
  const kept = keptColumnOrder(columns, saved, drag.from);
  if (kept !== null) setBoardOrder(kept);
  const from = cardLabel(columns, drag.convId, drag.from);
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

export async function renameBoardLabel(rows: readonly ChannelListRow[], entry: LabelEntry, name: string): Promise<void> {
  renameLabelEntry(entry, name);
  const names = labelNames(entry);
  const results = await Promise.allSettled(
    labelCarriers(rows, entry).map(convId => renameGroupLabel(lineOfConv(convId), names, name)),
  );
  const outcome = renameOutcome(results);
  if (outcome !== null) capabilities.toast(outcome);
}
