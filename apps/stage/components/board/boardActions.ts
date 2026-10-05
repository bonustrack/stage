import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { setBoardOrder } from '../../lib/boardOrder';
import { moveCategory } from '../../lib/channelGroups';
import { isCategoryKey } from '../../lib/channelGroups.model';
import { capabilities } from '../../lib/capabilities';
import { LabelPermissionError } from '@stage-labs/client/xmtp/labels';
import { addGroupLabel, moveGroupLabel, removeGroupLabel, renameGroupLabel, setGroupField } from '../../lib/xmtp.groups';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { toastLabelError } from '../channel/channel.labels';
import {
  addedColumnOrder, cardColumnEdit, columnCarriers, deleteColumnConfirm, deletedColumnOrder, keptColumnOrder, labelCapNote,
  movedColumnOrder, renamedColumnOrder, type BoardColumn, type BoardDrag, type EditableColumnBy,
} from './BoardScreen.model';

export function addBoardColumn(
  columns: readonly BoardColumn<unknown>[], saved: readonly string[], name: string, by: EditableColumnBy,
): void {
  setBoardOrder(addedColumnOrder(columns.map(column => column.key), saved, name, by));
}

export function dropOnBoard(
  columns: readonly BoardColumn<unknown>[], saved: readonly string[], drag: BoardDrag, key: string, by: GroupKey,
): void {
  if (drag.kind === 'column') {
    const shown = columns.map(column => column.key);
    if (isCategoryKey(drag.key)) { moveCategory(drag.key, key, shown); return; }
    const next = movedColumnOrder(shown, saved, drag.key, key);
    if (next !== null) setBoardOrder(next);
    return;
  }
  const edit = cardColumnEdit(columns, drag.from, key, by);
  if (edit === null) return;
  const kept = keptColumnOrder(columns, saved, drag.from);
  if (kept !== null) setBoardOrder(kept);
  const line = lineOfConv(drag.convId);
  const write = edit.by === 'status' ? setGroupField(line, 'status', edit.value) : moveGroupLabel(line, edit.from, edit.to);
  void write.catch(toastLabelError);
}

function columnOutcome(
  results: readonly PromiseSettledResult<unknown>[], failure: string, refusal: string, by: EditableColumnBy,
): string | null {
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const refused = failed.filter(r => r.reason instanceof LabelPermissionError).length;
  if (failed.length > refused) return failure;
  if (refused === 0) return null;
  const field = by === 'label' ? 'labels' : 'status';
  return refused === 1
    ? `1 channel ${refusal}, no permission to edit its ${field}.`
    : `${refused} channels ${refusal}, no permission to edit their ${field}.`;
}

export async function renameBoardColumn(
  rows: readonly ChannelListRow[], columns: readonly BoardColumn<unknown>[], saved: readonly string[],
  from: string, to: string, by: EditableColumnBy,
): Promise<void> {
  setBoardOrder(renamedColumnOrder(columns.map(c => c.key), saved, from, to, by));
  const results = await Promise.allSettled(columnCarriers(rows, from, by).map(convId => (
    by === 'status' ? setGroupField(lineOfConv(convId), 'status', to) : renameGroupLabel(lineOfConv(convId), from, to)
  )));
  const outcome = columnOutcome(results, `Could not rename the ${by} in every channel. Try again.`, 'kept the old name', by);
  if (outcome !== null) capabilities.toast(outcome);
}

export async function deleteBoardColumn(
  rows: readonly ChannelListRow[], columns: readonly BoardColumn<unknown>[], saved: readonly string[], label: string, by: EditableColumnBy,
): Promise<void> {
  const carriers = columnCarriers(rows, label, by);
  const confirm = deleteColumnConfirm(label, carriers.length, by);
  if (!await capabilities.confirm({ ...confirm, confirmLabel: 'Delete', destructive: true })) return;
  setBoardOrder(deletedColumnOrder(columns.map(c => c.key), saved, label, by));
  const results = await Promise.allSettled(carriers.map(convId => (
    by === 'status' ? setGroupField(lineOfConv(convId), 'status', null) : removeGroupLabel(lineOfConv(convId), label)
  )));
  const outcome = columnOutcome(results, `Could not remove the ${by} from every channel. Try again.`, `kept the ${by}`, by);
  if (outcome !== null) capabilities.toast(outcome);
}

export async function addToBoardColumn(convIds: readonly string[], label: string, by: EditableColumnBy): Promise<void> {
  const results = await Promise.allSettled(convIds.map(convId => (
    by === 'status' ? setGroupField(lineOfConv(convId), 'status', label) : addGroupLabel(lineOfConv(convId), label)
  )));
  const added = results.flatMap(r => (r.status === 'fulfilled' && Array.isArray(r.value) ? [r.value] : []));
  const notes = [
    columnOutcome(results, `Could not set the ${by} in every channel. Try again.`, `did not get the ${by}`, by),
    by === 'label' ? labelCapNote(added, label) : null,
  ].filter((note): note is string => note !== null);
  if (notes.length > 0) capabilities.toast(notes.join(' '));
}
