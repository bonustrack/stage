import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { setBoardOrder } from '../../lib/boardOrder';
import { capabilities } from '../../lib/capabilities';
import {
  LabelPermissionError, addGroupLabel, lineOfConv, moveGroupLabel, removeGroupLabel, renameGroupLabel,
} from '../../modules/messaging';
import { toastLabelError } from '../group/group.labels';
import {
  addedColumnOrder, columnLabel, deleteColumnConfirm, deletedColumnOrder, keptColumnOrder, labelCapNote, labelCarriers,
  movedColumnOrder, renamedColumnOrder, type BoardColumn, type BoardDrag,
} from './BoardScreen.model';

export function addBoardColumn(columns: readonly BoardColumn<unknown>[], saved: readonly string[], name: string): void {
  setBoardOrder(addedColumnOrder(columns.map(column => column.key), saved, name));
}

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
  void moveGroupLabel(lineOfConv(drag.convId), columnLabel(columns, drag.from), columnLabel(columns, key)).catch(toastLabelError);
}

function labelOutcome(results: readonly PromiseSettledResult<unknown>[], failure: string, refusal: string): string | null {
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const refused = failed.filter(r => r.reason instanceof LabelPermissionError).length;
  if (failed.length > refused) return failure;
  if (refused === 0) return null;
  return refused === 1
    ? `1 group ${refusal}, no permission to edit its labels.`
    : `${refused} groups ${refusal}, no permission to edit their labels.`;
}

export async function renameBoardLabel(
  rows: readonly ChannelListRow[], columns: readonly BoardColumn<unknown>[], saved: readonly string[],
  from: string, to: string,
): Promise<void> {
  setBoardOrder(renamedColumnOrder(columns.map(c => c.key), saved, from, to));
  const results = await Promise.allSettled(
    labelCarriers(rows, from).map(convId => renameGroupLabel(lineOfConv(convId), from, to)),
  );
  const outcome = labelOutcome(results, 'Could not rename the label in every group. Try again.', 'kept the old name');
  if (outcome !== null) capabilities.toast(outcome);
}

export async function deleteBoardLabel(
  rows: readonly ChannelListRow[], columns: readonly BoardColumn<unknown>[], saved: readonly string[], label: string,
): Promise<void> {
  const carriers = labelCarriers(rows, label);
  const confirm = deleteColumnConfirm(label, carriers.length);
  if (!await capabilities.confirm({ ...confirm, confirmLabel: 'Delete', destructive: true })) return;
  setBoardOrder(deletedColumnOrder(columns.map(c => c.key), saved, label));
  const results = await Promise.allSettled(carriers.map(convId => removeGroupLabel(lineOfConv(convId), label)));
  const outcome = labelOutcome(results, 'Could not remove the label from every group. Try again.', 'kept the label');
  if (outcome !== null) capabilities.toast(outcome);
}

export async function addToBoardLabel(convIds: readonly string[], label: string): Promise<void> {
  const results = await Promise.allSettled(convIds.map(convId => addGroupLabel(lineOfConv(convId), label)));
  const added = results.filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled').map(r => r.value);
  const notes = [
    labelOutcome(results, 'Could not add the label to every group. Try again.', 'did not get the label'),
    labelCapNote(added, label),
  ].filter((note): note is string => note !== null);
  if (notes.length > 0) capabilities.toast(notes.join(' '));
}
