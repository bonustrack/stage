
import { MarkdownIt } from 'react-native-markdown-display';

export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

const DEEP_LINK_RULE = {
  validate(text: string, pos: number): number {
    const m = /^\/\/[^\s]+/.exec(text.slice(pos));
    return m ? m[0].length : 0;
  },
};
mdParser.linkify.add('metro:', DEEP_LINK_RULE);
mdParser.linkify.add('stage:', DEEP_LINK_RULE);
