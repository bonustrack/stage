export function profileDisplayName(
  address: string,
  resolvedName: string | null | undefined,
  shortAddress: string,
): string {
  if (!address) return 'Loading…';
  const trimmed = resolvedName?.trim();
  return trimmed !== undefined && trimmed !== '' ? trimmed : shortAddress;
}

interface ProfileMenuItem { id: 'edit'; label: string; icon: 'IconPencil' }

export function profileMenuItems(isSelf: boolean): ProfileMenuItem[] {
  return isSelf ? [{ id: 'edit', label: 'Edit profile', icon: 'IconPencil' }] : [];
}
