/** Convert markdown → Telegram HTML. Stream-safe: unmatched markers fall through as literal text. */

const ENTITY_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const esc = (s: string): string => s.replace(/[&<>]/g, c => ENTITY_MAP[c]);

/** SOH — invalid in Telegram text + never in user output, so collisions are impossible. */
const SENT = '\x01';

export function mdToTelegramHtml(md: string): string {
  const slots: string[] = [];
  const stash = (html: string): string => { slots.push(html); return `${SENT}${slots.length - 1}${SENT}`; };

  /* Fenced code first so its contents aren't touched by other rules. */
  let work = md.replace(/```([A-Za-z0-9_+\-.]*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    return stash(lang
      ? `<pre><code class="language-${esc(lang)}">${esc(code)}</code></pre>`
      : `<pre>${esc(code)}</pre>`);
  });

  /* Inline code (single-line only — multi-line spans look like unclosed mid-stream fences). */
  work = work.replace(/`([^`\n]+)`/g, (_m, code: string) => stash(`<code>${esc(code)}</code>`));
  work = esc(work);
  work = work.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) =>
    stash(`<a href="${url.replace(/"/g, '%22')}">${text}</a>`));

  /* Bold before italic so `*`-rule doesn't eat half of `**bold**`. */
  work = work.replace(/\*\*([^*\n]+?)\*\*/g, '<b>$1</b>').replace(/__([^_\n]+?)__/g, '<b>$1</b>');
  /* \S guards keep `2 * 3` arithmetic and `foo_bar` identifiers intact. */
  work = work
    .replace(/(^|[^*\w])\*(\S[^*\n]*?\S|\S)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(^|[^_\w])_(\S[^_\n]*?\S|\S)_(?!\w)/g, '$1<i>$2</i>');
  work = work.replace(/~~([^~\n]+?)~~/g, '<s>$1</s>');
  /* Headings → bold (Telegram has no heading element). */
  work = work.replace(/^#{1,6}\s+(.+?)\s*$/gm, '<b>$1</b>');

  /* Collapse consecutive `> ` lines into one <blockquote>. */
  work = work.replace(/(^|\n)((?:&gt;\s?[^\n]*\n?)+)/g, (_m, lead: string, block: string) => {
    const inner = block.replace(/^&gt;\s?/gm, '').replace(/\n+$/, '');
    return `${lead}<blockquote>${inner}</blockquote>${block.endsWith('\n') ? '\n' : ''}`;
  });

  return work.replace(new RegExp(`${SENT}(\\d+)${SENT}`, 'g'), (_m, idx: string) => slots[Number(idx)]);
}
