/**
 * @file Renders message text to sanitised HTML via markdown-it (linkify, breaks, hardened external links), matching the mobile app's markdown behaviour.
 */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer nofollow');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

/** Render Markdown text to sanitised HTML with external links hardened. */
export function renderMarkdown(text: string): string {
  return md.render(text);
}
