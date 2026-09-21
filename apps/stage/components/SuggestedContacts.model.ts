export const SUGGESTED_CONTACTS: readonly string[] = ['0xa94Cb9AA3CB82880142ff98706320E1Fb9B31767'];

export const SUGGESTED_HEADING = 'SUGGESTED';
export const SUGGESTED_SUBTITLE = 'Suggested contact';

export function suggestedContacts(known: Iterable<string>, self: string | null, pool: readonly string[] = SUGGESTED_CONTACTS): string[] {
  const taken = new Set<string>();
  for (const address of known) taken.add(address.toLowerCase());
  if (self !== null) taken.add(self.toLowerCase());
  return pool.filter((address) => !taken.has(address.toLowerCase()));
}
