import type { GroupMetaPatch } from '@stage-labs/client/xmtp/groups';

export const GROUP_NAME_MAX = 100;
export const GROUP_DESCRIPTION_MAX = 1000;

export interface GroupDraft { name: string; description: string }

export interface GroupCurrent { name: string | null; description: string }

export interface GroupMetaCachePatch { groupName?: string; groupDescription?: string; groupImage?: string }

export function groupDraftFrom(current: GroupCurrent): GroupDraft {
  return { name: current.name ?? '', description: current.description };
}

export function groupChanges(current: GroupCurrent, draft: GroupDraft): GroupMetaPatch {
  const out: GroupMetaPatch = {};
  const name = draft.name.trim();
  const description = draft.description.trim();
  if (name !== (current.name ?? '').trim()) out.name = name;
  if (description !== current.description.trim()) out.description = description;
  return out;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function groupDraftProblem(current: GroupCurrent, draft: GroupDraft): string | null {
  const { name, description } = groupChanges(current, draft);
  if (name !== undefined) {
    if (!name) return 'A group needs a name.';
    if (/[\r\n]/.test(name)) return 'Name cannot span several lines.';
    if (byteLength(name) > GROUP_NAME_MAX) return 'Name is too long.';
  }
  if (description !== undefined && byteLength(description) > GROUP_DESCRIPTION_MAX) return 'Description is too long.';
  return null;
}

export function groupMetaCachePatch(patch: GroupMetaPatch): GroupMetaCachePatch {
  const out: GroupMetaCachePatch = {};
  if (patch.name !== undefined) out.groupName = patch.name;
  if (patch.description !== undefined) out.groupDescription = patch.description;
  if (patch.imageUrl !== undefined) out.groupImage = patch.imageUrl;
  return out;
}

export interface LabelEdits { added: string[]; removed: string[] }

function missingFrom(labels: string[], other: string[]): string[] {
  const keys = new Set(other.map((l) => l.toLowerCase()));
  return labels.filter((l) => !keys.has(l.toLowerCase()));
}

export function labelEdits(current: string[], draft: string[]): LabelEdits {
  return { added: missingFrom(draft, current), removed: missingFrom(current, draft) };
}

export function hasLabelEdits(edits: LabelEdits): boolean {
  return edits.added.length > 0 || edits.removed.length > 0;
}
