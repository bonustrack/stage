/** @file Shared markdown-it instance for chat bodies that also registers the `metro://`/`stage://` deep-link schemes with linkify so custom-scheme links render tappable. */

import { MarkdownIt } from 'react-native-markdown-display';

/** `linkify` + `breaks` turn bare URLs into tappable links and treat `\n` as a line break, matching the markdown-it config on the web side. Constructed once at module scope — the lib re-parses input each render anyway. */
export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

/** Register our custom deep-link schemes (`metro:`, `stage:`) with linkify-it so PR-preview links become tappable; `validate` consumes the tail up to whitespace (incl. percent-encoded params) and returns its length, leaving http(s)/mailto autolinking untouched. */
const DEEP_LINK_RULE = {
  validate(text: string, pos: number): number {
    const m = /^\/\/[^\s]+/.exec(text.slice(pos));
    return m ? m[0].length : 0;
  },
};
mdParser.linkify.add('metro:', DEEP_LINK_RULE);
mdParser.linkify.add('stage:', DEEP_LINK_RULE);
