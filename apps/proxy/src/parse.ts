/**
 * @file Dependency-free regex HTML head parser that extracts OpenGraph/Twitter/title/description/favicon metadata into a PreviewMeta card (precedence OpenGraph > Twitter > bare HTML).
 */

export interface PreviewMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/** Decode the handful of HTML entities that show up in title/description text. */
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

/** Pull the content of every <meta> tag whose name/property matches `key` (case-insensitive), in document order. Handles attribute order variations (content before/after the name/property). */
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

/** First non-empty of a list of meta keys. */
function firstMeta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = metaContent(html, k);
    if (v) return v;
  }
  return undefined;
}

/** Title Tag. */
function titleTag(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const inner = m?.[1];
  return inner === undefined ? undefined : decodeEntities(inner.replace(/\s+/g, ' '));
}

/** Favicon from a <link rel="icon"|"shortcut icon"|"apple-touch-icon">. */
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
    if (rel === 'icon' || rel === 'shortcut icon') break; // prefer plain icon
  }
  return best;
}

/** Resolve a possibly-relative URL against the page's base. Returns undefined on failure rather than throwing. */
export function resolveUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href, base);
    // Only surface http(s) assets — never data:/javascript:/about: refs.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Extract preview metadata from raw HTML. `finalUrl` is the post-redirect URL, used both as the canonical `url` and to resolve relative image/favicon refs. */
export function parseMeta(html: string, finalUrl: string): PreviewMeta {
  // Only scan the head region for speed/safety; fall back to whole doc if no
  // </head> (some pages stream the title late).
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);

  const title = firstMeta(head, ['og:title', 'twitter:title']) ?? titleTag(head);
  const description = firstMeta(head, [
    'og:description',
    'twitter:description',
    'description',
  ]);
  const rawImage = firstMeta(head, [
    'og:image:secure_url',
    'og:image:url',
    'og:image',
    'twitter:image',
    'twitter:image:src',
  ]);
  const siteName = firstMeta(head, ['og:site_name', 'application-name', 'twitter:site']);
  const canonical = firstMeta(head, ['og:url']) ?? finalUrl;

  let host = finalUrl;
  try {
    host = new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch { /* keep finalUrl */ }

  return {
    url: canonical,
    title: title !== undefined && title.length > 0 ? title : host,
    description: description !== undefined && description.length > 0 ? description : undefined,
    image: resolveUrl(rawImage, finalUrl),
    siteName: siteName !== undefined && siteName.length > 0 ? siteName : host,
    favicon: resolveUrl(faviconLink(head) ?? '/favicon.ico', finalUrl),
  };
}
