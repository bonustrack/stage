/** Snapshot docs index for grounding the agent's replies.
 *
 *  v1: fetch the docs.snapshot.org sitemap, scrape each page's text, store as JSONL at
 *  `~/.cache/metro/agents/snapshot-docs.jsonl`. Retrieval is naive substring scoring —
 *  good enough for "find the 3 most-relevant pages". Embeddings + a vector store are a
 *  follow-up (see TODO at bottom). */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const DOCS_DIR = join(STATE_DIR, 'agents');
const DOCS_FILE = join(DOCS_DIR, 'snapshot-docs.jsonl');
const SITEMAP_URL = 'https://docs.snapshot.box/sitemap.xml';
const FETCH_TIMEOUT_MS = 20_000;

export interface DocChunk {
  url: string;
  title: string;
  text: string;
}

/** Strip HTML to plain text. Naive but fine for static docs sites. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function titleOf(html: string, url: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : url;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

/** Pull URLs out of an XML sitemap. Returns at most `max` URLs. */
function parseSitemap(xml: string, max: number = 200): string[] {
  const out: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) && out.length < max) out.push(m[1].trim());
  return out;
}

/** Re-fetch every page in the sitemap, replace the local index. */
export async function refreshDocsIndex(): Promise<{ pages: number; bytes: number }> {
  mkdirSync(DOCS_DIR, { recursive: true });
  log.info({ url: SITEMAP_URL }, 'snapshot-docs: refreshing index');
  const sitemap = await fetchText(SITEMAP_URL);
  const urls = parseSitemap(sitemap);
  const chunks: DocChunk[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const text = htmlToText(html);
      if (text.length < 200) continue;  /** skip near-empty stubs */
      chunks.push({ url, title: titleOf(html, url), text });
    } catch (err) {
      log.warn({ url, err: errMsg(err) }, 'snapshot-docs: page fetch failed');
    }
  }
  const out = chunks.map(c => JSON.stringify(c)).join('\n') + '\n';
  writeFileSync(DOCS_FILE, out);
  log.info({ pages: chunks.length, bytes: out.length, path: DOCS_FILE }, 'snapshot-docs: index written');
  return { pages: chunks.length, bytes: out.length };
}

let cached: DocChunk[] | null = null;
function loadIndex(): DocChunk[] {
  if (cached) return cached;
  if (!existsSync(DOCS_FILE)) return cached = [];
  cached = readFileSync(DOCS_FILE, 'utf8').trim().split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l) as DocChunk; } catch { return null; } })
    .filter((c): c is DocChunk => c !== null);
  return cached;
}

/** Naive retrieval: lowercase substring scoring. Returns top-k chunks by hit count.
 *  TODO: replace with a real embedding store (text-embedding-3-small + cosine over a
 *  sqlite virtual table) once we want better semantic recall. Substring matching
 *  fails for paraphrased questions but is fine for explicit terminology lookups. */
export function retrieve(query: string, k: number = 3): DocChunk[] {
  const idx = loadIndex();
  if (idx.length === 0) return [];
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  if (terms.length === 0) return [];
  const scored = idx.map(c => {
    const hay = (c.title + ' ' + c.text).toLowerCase();
    let score = 0;
    for (const t of terms) {
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      score += (hay.match(re) ?? []).length;
    }
    return { chunk: c, score };
  });
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map(s => s.chunk);
}
