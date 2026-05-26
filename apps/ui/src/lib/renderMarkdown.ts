/** Render message text the same way the mobile app does (react-native-markdown-display
 *  uses MarkdownIt with linkify + breaks) so bare URLs become clickable links and
 *  `\n` becomes a line break. `html: false` escapes any raw HTML in the message, and
 *  markdown-it's default validateLink blocks javascript:/data: URLs — so the output is
 *  safe to drop in with v-html. Links open in a new tab. */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow');
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(text: string): string {
  return md.render(text);
}
