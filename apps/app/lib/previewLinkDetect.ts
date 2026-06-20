

export interface PreviewLinkRef {
  url: string;
  groupId: string;
  shortGroup: string;
}

const RE =
  /(?:(?:metro|stage):\/\/expo-development-client\/\?url=|https?:\/\/(?:metro|stage)\.box\/preview-launcher\.html\?u=)(\S+)/i;

export function previewLinkOf(text?: string | null): PreviewLinkRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const url = m[0];
  const rawInner = m[1];
  if (rawInner === undefined) return null;
  let inner = rawInner;
  try {
    inner = decodeURIComponent(rawInner);
  } catch {
  }
  const g = /u\.expo\.dev\/[^/\s]+\/group\/([A-Za-z0-9-]+)/i.exec(inner);
  if (!g) return null;
  const groupId = g[1];
  if (groupId === undefined) return null;
  return { url, groupId, shortGroup: groupId.slice(0, 8) };
}
