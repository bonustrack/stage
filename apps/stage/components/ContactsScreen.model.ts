interface ContactNameDomain {
  resolvedName: string | null;
  fallbackName: string;
  shortAddress: string;
}

interface ContactNameModel {
  name: string;
  handle?: string;
}

export function contactNameModel(d: ContactNameDomain): ContactNameModel {
  if (d.resolvedName !== null && d.resolvedName !== '') {
    return { name: d.resolvedName, handle: d.shortAddress };
  }
  return { name: d.fallbackName, handle: undefined };
}
