
export interface PreviewMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .trim();
}

function metaContent(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]*?(?:name|property)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*?>`,
    'i',
  );
  const tag = re.exec(html);
  if (!tag) return undefined;
  const c = /content=["']([^"']*)["']/i.exec(tag[0]);
  const content = c?.[1];
  return content === undefined ? undefined : decodeEntities(content);
}

function firstMeta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = metaContent(html, k);
    if (v) return v;
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const inner = m?.[1];
  return inner === undefined ? undefined : decodeEntities(inner.replace(/\s+/g, ' '));
}

function faviconLink(html: string): string | undefined {
  const re = /<link[^>]*rel=["']([^"']*)["'][^>]*>/gi;
  let best: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const rel = (m[1] ?? '').toLowerCase();
    if (!/\bicon\b/.test(rel)) continue;
    const href = /href=["']([^"']+)["']/i.exec(m[0]);
    const hrefVal = href?.[1];
    if (hrefVal === undefined) continue;
    best = decodeEntities(hrefVal);
    if (rel === 'icon' || rel === 'shortcut icon') break;
  }
  return best;
}

export function resolveUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function orFallback(v: string | undefined, fallback: string): string {
  return v !== undefined && v.length > 0 ? v : fallback;
}

function orUndefined(v: string | undefined): string | undefined {
  return v !== undefined && v.length > 0 ? v : undefined;
}

function hostOf(finalUrl: string): string {
  try {
    return new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {
    return finalUrl;
  }
}

export function parseMeta(html: string, finalUrl: string): PreviewMeta {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);

  const title = firstMeta(head, ['og:title', 'twitter:title']) ?? titleTag(head);
  const description = firstMeta(head, ['og:description', 'twitter:description', 'description']);
  const rawImage = firstMeta(head, [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
  ]);
  const siteName = firstMeta(head, ['og:site_name', 'application-name', 'twitter:site']);
  const canonical = firstMeta(head, ['og:url']) ?? finalUrl;
  const host = hostOf(finalUrl);

  return {
    url: canonical,
    title: orFallback(title, host),
    description: orUndefined(description),
    image: resolveUrl(rawImage, finalUrl),
    siteName: orFallback(siteName, host),
    favicon: resolveUrl(faviconLink(head) ?? '/favicon.ico', finalUrl),
  };
}
