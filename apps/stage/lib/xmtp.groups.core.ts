export interface GroupMeta { name?: string; imageUrl?: string }

export interface GroupInfo { name: string; imageUrl: string; description: string }

export interface GroupAdmins { admins: string[]; superAdmins: string[] }

export const NO_GROUP_ADMINS: GroupAdmins = { admins: [], superAdmins: [] };

export function groupMeta(name?: string, imageUrl?: string): GroupMeta {
  const meta: GroupMeta = {};
  const trimmedName = name?.trim();
  if (trimmedName) meta.name = trimmedName;
  const trimmedImage = imageUrl?.trim();
  if (trimmedImage) meta.imageUrl = trimmedImage;
  return meta;
}

export function requireConv<T>(conv: T | null): T {
  if (!conv) throw new Error('Conversation not found');
  return conv;
}

export function notAGroup(): never {
  throw new Error('Not a group conversation');
}
