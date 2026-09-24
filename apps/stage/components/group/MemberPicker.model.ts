export interface PickerMember { address: string; label: string }
export interface PickerContact { address: string; name: string }

export function pickerRows<C extends PickerContact>(
  members: readonly PickerMember[], contacts: readonly C[], toContact: (m: PickerMember) => C,
): C[] {
  const picked = new Set(members.map(m => m.address.toLowerCase()));
  const byAddress = new Map(contacts.map(c => [c.address.toLowerCase(), c]));
  const selected = members.map(m => byAddress.get(m.address.toLowerCase()) ?? toContact(m));
  return [...selected, ...contacts.filter(c => !picked.has(c.address.toLowerCase()))];
}
