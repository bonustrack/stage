// Convert agent-style markdown to Telegram's HTML parse mode.
//
// Telegram HTML accepts only a small tag set: <b>, <i>, <u>, <s>, <code>,
// <pre>, <a href>, <blockquote>, <tg-spoiler>. Outside tags, the only chars
// requiring escape are <, >, & — which keeps streaming partial input (e.g.
// a half-typed `**bold` mid-flush) safe to send as-is: any unpaired marker
// just stays as plain text until its closer arrives on a later edit.

const ENTITY_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
function esc(s: string): string {
  return s.replace(/[&<>]/g, c => ENTITY_MAP[c]);
}

// Sentinel used as a placeholder boundary for stashed HTML fragments. NUL
// never appears in real agent output, so collisions aren't a concern.
const NUL = '\u0000';

/**
 * Render GitHub-flavored markdown (the kind agents emit) as Telegram HTML.
 * Designed to be safe on partial input — unmatched markers fall through as
 * literal text rather than producing unbalanced tags.
 */
export function mdToTelegramHtml(md: string): string {
  const slots: string[] = [];
  const stash = (html: string): string => {
    slots.push(html);
    return `${NUL}${slots.length - 1}${NUL}`;
  };

  // Fenced code blocks (``` ... ```) — extract first so their contents
  // aren't touched by other rules. The optional language hint becomes a
  // `language-*` class on the inner <code>, which Telegram preserves.
  let work = md.replace(/```([A-Za-z0-9_+\-.]*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const inner = lang
      ? `<pre><code class="language-${esc(lang)}">${esc(code)}</code></pre>`
      : `<pre>${esc(code)}</pre>`;
    return stash(inner);
  });

  // Inline code (`…`). Skip multi-line spans — those are likely an unclosed
  // fence, and collapsing them onto one line would mangle the output.
  work = work.replace(/`([^`\n]+)`/g, (_m, code: string) => stash(`<code>${esc(code)}</code>`));

  // Everything outside the stashes is plain text — escape <, >, & now so
  // user-supplied angle brackets can't be confused with HTML tags below.
  work = esc(work);

  // Links [text](url). Stash so the tag itself isn't re-processed.
  work = work.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    const safeUrl = url.replace(/"/g, '%22');
    return stash(`<a href="${safeUrl}">${text}</a>`);
  });

  // Bold runs before italic so the single-* rule doesn't eat the inner half
  // of a `**bold**` pair.
  work = work.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>');
  work = work.replace(/__([^_\n]+?)__/g, '<b>$1</b>');

  // Italic. The boundary guards avoid matching identifiers like `foo_bar`
  // or arithmetic like `2*3*4`, which agents emit frequently.
  work = work.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
  work = work.replace(/(^|[^_\w])_([^_\n]+?)_(?!\w)/g, '$1<i>$2</i>');

  // Strikethrough.
  work = work.replace(/~~([^~\n]+?)~~/g, '<s>$1</s>');

  // Headings → bold. Telegram has no heading element; bolding the line
  // keeps the visual hierarchy without dropping content.
  work = work.replace(/^#{1,6}\s+(.+?)\s*$/gm, '<b>$1</b>');

  // Blockquotes — collapse consecutive `> ` lines into one <blockquote>.
  // We match on `&gt;` because the escape pass already ran.
  work = work.replace(/(^|\n)((?:&gt;\s?[^\n]*\n?)+)/g, (_m, lead: string, block: string) => {
    const inner = block.replace(/^&gt;\s?/gm, '').replace(/\n+$/, '');
    const trailingNl = block.endsWith('\n') ? '\n' : '';
    return `${lead}<blockquote>${inner}</blockquote>${trailingNl}`;
  });

  // Restore stashed HTML fragments.
  work = work.replace(new RegExp(`${NUL}(\\d+)${NUL}`, 'g'), (_m, idx: string) => slots[Number(idx)]);
  return work;
}
