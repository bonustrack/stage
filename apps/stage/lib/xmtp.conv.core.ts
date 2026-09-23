import { registerHiddenConv } from './readSyncRegistry';

export async function withoutSyncGroups<C extends { id: string }>(
  convs: C[], isSyncGroup: (conv: C) => Promise<boolean>,
): Promise<C[]> {
  const flags = await Promise.all(convs.map((c) => isSyncGroup(c).catch(() => false)));
  return convs.filter((c, i) => {
    if (flags[i] === true) registerHiddenConv(c.id);
    return flags[i] !== true;
  });
}
