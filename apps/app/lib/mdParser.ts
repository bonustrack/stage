/** Shared markdown-it instance for chat message bodies. Extracted from
 *  `MessengerBubble.helpers` (which is at the phase-2 line cap) so the custom
 *  deep-link scheme registration has room to live. */

import { MarkdownIt } from 'react-native-markdown-display';

/** `linkify` + `breaks` turn bare URLs into tappable links and treat `\n` as a line
 *  break, matching the markdown-it config on the web side. Constructed once at
 *  module scope — the lib re-parses input each render anyway. */
export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

/** linkify-it only autolinks schemes it knows about (http/https/mailto/…); our
 *  custom deep-link schemes (`metro://`, `stage://`) would otherwise render as
 *  dead text. Register them so e.g. dev-client PR-preview links
 *  (`metro://expo-development-client/?url=https%3A%2F%2F…`) become tappable —
 *  `BubbleContent`'s `onLinkPress` then opens them via `Linking.openURL`.
 *  `validate` consumes the `//<rest-up-to-whitespace>` tail (incl. percent-encoded
 *  query params), returning its length so linkify-it knows where the URL ends.
 *  http(s)/mailto autolinking is untouched. */
const DEEP_LINK_RULE = {
  validate(text: string, pos: number): number {
    const m = text.slice(pos).match(/^\/\/[^\s]+/);
    return m ? m[0].length : 0;
  },
};
mdParser.linkify.add('metro:', DEEP_LINK_RULE);
mdParser.linkify.add('stage:', DEEP_LINK_RULE);
