export interface ContactNameDomain {
  resolvedName: string | null;
  fallbackName: string;
  shortAddress: string;
}

export interface ContactNameModel {
  name: string;
  handle?: string;
}

export function contactNameModel(d: ContactNameDomain): ContactNameModel {
  if (d.resolvedName !== null && d.resolvedName !== '') {
    return { name: d.resolvedName, handle: d.shortAddress };
  }
  return { name: d.fallbackName, handle: undefined };
}

export function contactsEmptyLabel(loading: boolean): string {
  return loading ? 'Loading contacts…' : 'No contacts yet. Start a chat to add one.';
}
