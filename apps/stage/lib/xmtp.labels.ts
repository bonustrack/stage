
import {
  MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, asGroup,
  groupLabelsOf, addLabel, removeLabel, writeLabels,
} from '@stage-labs/client/xmtp/labels';
import { convOfLine } from './xmtp.sdk';

export { MAX_LABELS, MAX_LABEL_LEN, LabelPermissionError, groupLabelsOf };

export async function getGroupLabels(line: string): Promise<string[]> {
  return groupLabelsOf(await convOfLine(line), true);
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
