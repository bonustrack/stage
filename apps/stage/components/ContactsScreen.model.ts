interface ContactNameDomain {
  resolvedName: string | null;
  fallbackName: string;
  shortAddress: string;
  description?: string;
}

interface ContactNameModel {
  name: string;
  subtitle?: string;
}

function singleLine(text: string | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

export function contactNameModel(d: ContactNameDomain): ContactNameModel {
  const about = singleLine(d.description);
  const resolved = d.resolvedName ?? '';
  if (resolved === '') return { name: d.fallbackName, subtitle: about === '' ? undefined : about };
  return { name: resolved, subtitle: about === '' ? d.shortAddress : about };
}
