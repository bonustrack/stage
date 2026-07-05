
import {
  MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, asGroup,
  parseBlob, readLabels, labelsOfSyncedGroup, addLabel, removeLabel, writeLabels,
  type Group,
} from '@stage-labs/client/xmtp/labels';
import { convOfLine } from './xmtp';

export {
  MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, asGroup,
  parseBlob, readLabels, labelsOfSyncedGroup,
};
export type { Group };

export async function getGroupLabels(line: string): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) return [];
  try {
    await group.sync?.();
    const appData = await group.appData();
    return readLabels(parseBlob(appData));
  } catch {
    return [];
  }
}

async function mutate(line: string, fn: (labels: string[]) => string[]): Promise<string[]> {
  const conv = await convOfLine(line);
  const group = asGroup(conv);
  if (!group) throw new Error('Not a group conversation');
  return writeLabels(group, fn);
}

export async function addGroupLabel(line: string, label: string): Promise<string[]> {
  return mutate(line, (labels) => addLabel(labels, label));
}

export async function removeGroupLabel(line: string, label: string): Promise<string[]> {
  return mutate(line, (labels) => removeLabel(labels, label));
}
