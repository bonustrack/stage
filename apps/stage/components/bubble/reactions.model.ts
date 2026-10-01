import { SELF_NAME } from '../conversation/reactors.model';

interface ReactionPillModel {
  emoji: string;
  names: string[];
  own: boolean;
  pending: boolean;
}

export function ownsReaction(confirmed: boolean, adding: boolean, removing: boolean): boolean {
  if (adding) return true;
  if (removing) return false;
  return confirmed;
}

function namesAfterPending(names: readonly string[], confirmedOwn: boolean, own: boolean): string[] {
  if (own === confirmedOwn) return [...names];
  if (own) return [SELF_NAME, ...names];
  return names[0] === SELF_NAME ? names.slice(1) : [...names];
}

export function reactionPills(
  confirmed: ReadonlyMap<string, readonly string[]> | undefined,
  ownEmojis: ReadonlySet<string> | undefined,
  pendingAdds: readonly string[] | undefined,
  pendingRemovals: readonly string[] | undefined,
): ReactionPillModel[] {
  const adds = new Set(pendingAdds);
  const removals = new Set(pendingRemovals);
  const emojis = [...(confirmed?.keys() ?? []), ...[...adds].filter(e => !confirmed?.has(e))];
  return emojis.flatMap((emoji) => {
    const confirmedNames = confirmed?.get(emoji) ?? [];
    const confirmedOwn = !!ownEmojis?.has(emoji);
    const own = ownsReaction(confirmedOwn, adds.has(emoji), removals.has(emoji));
    const names = namesAfterPending(confirmedNames, confirmedOwn, own);
    if (names.length === 0) return [];
    return [{ emoji, names, own, pending: own && confirmedNames.length === 0 }];
  });
}
