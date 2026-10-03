import type { GroupMetaPatch } from '@stage-labs/client/xmtp/groups';

export const CHANNEL_NAME_MAX = 100;
export const CHANNEL_DESCRIPTION_MAX = 1000;

export interface ChannelDraft { name: string; description: string }

export interface ChannelCurrent { name: string | null; description: string }

export function channelDraftFrom(current: ChannelCurrent): ChannelDraft {
  return { name: current.name ?? '', description: current.description };
}

export function channelChanges(current: ChannelCurrent, draft: ChannelDraft): GroupMetaPatch {
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

export function channelDraftProblem(current: ChannelCurrent, draft: ChannelDraft): string | null {
  const { name, description } = channelChanges(current, draft);
  if (name !== undefined) {
    if (!name) return 'A channel needs a name.';
    if (/[\r\n]/.test(name)) return 'Name cannot span several lines.';
    if (byteLength(name) > CHANNEL_NAME_MAX) return 'Name is too long.';
  }
  if (description !== undefined && byteLength(description) > CHANNEL_DESCRIPTION_MAX) return 'Description is too long.';
  return null;
}
