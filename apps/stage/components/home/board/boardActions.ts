import type { ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';
import { setBoardOrder } from '../../../lib/boardOrder';
import { moveCategory } from '../../../lib/channelGroups';
import { groupingOrderStore } from '../../../lib/grouping.model';
import { saveGroupingOrder } from '../../../lib/groupingOrder';
import { capabilities } from '../../../lib/capabilities';
import { LabelPermissionError } from '@stage-labs/client/xmtp/labels';
import { moveGroupLabel, removeGroupLabel, renameGroupLabel, setGroupField } from '../../../lib/xmtp.groups';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { toastLabelError } from '../../channel/channelActions';
import { renameNewChatProject } from '../../newChat/newChatDefaults';
import {
  addedColumnOrder,
  cardColumnEdit,
  columnCarriers,
  columnNoun,
  deleteColumnConfirm,
  deletedColumnOrder,
  keptColumnOrder,
  movedColumnOrder,
  renamedColumnOrder,
  type BoardColumn,
  type EditableColumnBy,
} from './BoardScreen.model';

export function addBoardColumn(
  columns: readonly BoardColumn<unknown>[],
  saved: readonly string[],
  name: string,
  by: EditableColumnBy,
): void {
  saveGroupingOrder(
    by,
    addedColumnOrder(
      columns.map((column) => column.key),
      saved,
      name,
      by,
    ),
  );
}

export function dropColumn(
  columns: readonly BoardColumn<unknown>[],
  saved: readonly string[],
  from: string,
  target: string,
  by: GroupKey,
): void {
  const shown = columns.map((column) => column.key);
  if (groupingOrderStore(by) === 'categories') {
    moveCategory(from, target, shown);
    return;
  }
  const next = movedColumnOrder(shown, saved, from, target);
  if (next !== null) setBoardOrder(next);
}

export function dropCard(
  columns: readonly BoardColumn<unknown>[],
  saved: readonly string[],
  convId: string,
  from: string,
  to: string,
  by: GroupKey,
): void {
  const edit = cardColumnEdit(columns, from, to, by);
  if (edit === null) return;
  const kept = keptColumnOrder(columns, saved, from);
  if (kept !== null) saveGroupingOrder(by, kept);
  const line = lineOfConv(convId);
  const write = edit.by === 'label' ? moveGroupLabel(line, edit.from, edit.to) : setGroupField(line, edit.by, edit.value);
  void write.catch((e: unknown) => {
    toastLabelError(e, edit.by === 'label' ? 'labels' : `the ${columnNoun(edit.by)}`);
  });
}

function columnOutcome(
  results: readonly PromiseSettledResult<unknown>[],
  failure: string,
  refusal: string,
  by: EditableColumnBy,
): string | null {
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const refused = failed.filter((r) => r.reason instanceof LabelPermissionError).length;
  if (failed.length > refused) return failure;
  if (refused === 0) return null;
  const field = by === 'label' ? 'labels' : columnNoun(by);
  return refused === 1
    ? `1 channel ${refusal}, no permission to edit its ${field}.`
    : `${refused} channels ${refusal}, no permission to edit their ${field}.`;
}

export async function renameBoardColumn(
  rows: readonly ChannelListRow[],
  columns: readonly BoardColumn<unknown>[],
  saved: readonly string[],
  from: string,
  to: string,
  by: EditableColumnBy,
): Promise<void> {
  saveGroupingOrder(
    by,
    renamedColumnOrder(
      columns.map((c) => c.key),
      saved,
      from,
      to,
      by,
    ),
  );
  if (by === 'category') renameNewChatProject(from, to);
  const results = await Promise.allSettled(
    columnCarriers(rows, from, by).map((convId) =>
      by === 'label' ? renameGroupLabel(lineOfConv(convId), from, to) : setGroupField(lineOfConv(convId), by, to, from),
    ),
  );
  const outcome = columnOutcome(results, `Could not rename the ${columnNoun(by)} in every channel. Try again.`, 'kept the old name', by);
  if (outcome !== null) capabilities.toast(outcome);
}

export async function deleteBoardColumn(
  rows: readonly ChannelListRow[],
  columns: readonly BoardColumn<unknown>[],
  saved: readonly string[],
  label: string,
  by: EditableColumnBy,
): Promise<void> {
  const carriers = columnCarriers(rows, label, by);
  const confirm = deleteColumnConfirm(label, carriers.length, by);
  if (!(await capabilities.confirm({ ...confirm, confirmLabel: 'Delete', destructive: true }))) return;
  saveGroupingOrder(
    by,
    deletedColumnOrder(
      columns.map((c) => c.key),
      saved,
      label,
      by,
    ),
  );
  if (by === 'category') renameNewChatProject(label, null);
  const results = await Promise.allSettled(
    carriers.map((convId) =>
      by === 'label' ? removeGroupLabel(lineOfConv(convId), label) : setGroupField(lineOfConv(convId), by, null, label),
    ),
  );
  const outcome = columnOutcome(
    results,
    `Could not remove the ${columnNoun(by)} from every channel. Try again.`,
    `kept the ${columnNoun(by)}`,
    by,
  );
  if (outcome !== null) capabilities.toast(outcome);
}
