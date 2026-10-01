import { displayHandle } from '@stage-labs/client/identity/stageNames';

interface ContactNameDomain {
  resolvedName: string | null;
  fallbackName: string;
  shortAddress: string;
  description?: string;
  handle?: string;
}

interface ContactNameModel {
  name: string;
  subtitle: string;
}

function singleLine(text: string | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

function contactSubtitle(name: string, d: ContactNameDomain): string {
  const about = singleLine(d.description);
  if (about !== '') return about;
  const handle = d.handle?.trim() ?? '';
  const shownHandle = handle === '' ? '' : displayHandle(handle);
  if (shownHandle !== '' && shownHandle !== name) return shownHandle;
  return d.shortAddress;
}

export function contactNameModel(d: ContactNameDomain): ContactNameModel {
  const resolved = d.resolvedName ?? '';
  const name = resolved === '' ? d.fallbackName : resolved;
  return { name, subtitle: contactSubtitle(name, d) };
}
