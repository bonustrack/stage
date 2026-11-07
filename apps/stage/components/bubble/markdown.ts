import { fontSize, type FontSizeName } from '@stage-labs/kit/tokens';
import { markdownStyles as kitMarkdownStyles } from '@stage-labs/kit/markdown-styles';
import { MarkdownIt } from 'react-native-markdown-display';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';
import type { LinkFinder } from '@stage-labs/client/xmtp/messageBody';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import { keepIndent, literalStars, taskLists } from './markdown.model';
import { MESSAGE_BODY } from './MessageText';
import { textSelectable } from './interaction';

export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true }).use(literalStars).use(taskLists).use(keepIndent);

registerDeepLinkSchemas(mdParser.linkify);

export const findLinks: LinkFinder = (text) => mdParser.linkify.match(text);

export const MESSAGE_LINK_STYLE = { textDecorationLine: 'none' } as const;

export const BLOCK_GAP = 8;

export function markdownStyles(fg: string, dark: boolean, size: FontSizeName): Record<string, object> {
  const link = MESSAGE_LINK_COLOR[dark ? 'dark' : 'light'];
  const styles = kitMarkdownStyles({ fg, dark, link, fontSize: fontSize(size), lineHeight: MESSAGE_BODY.lineHeight, paragraphGap: 0 });
  const selection = { userSelect: textSelectable ? 'text' : 'none' };
  return {
    ...styles,
    body: { ...styles.body, gap: BLOCK_GAP },
    hr: { ...styles.hr, marginVertical: BLOCK_GAP / 2 },
    link: { ...styles.link, ...MESSAGE_LINK_STYLE },
    textgroup: { ...styles.textgroup, ...selection },
    bullet_list_icon: { ...styles.bullet_list_icon, ...selection },
    ordered_list_icon: { ...styles.ordered_list_icon, ...selection },
    code_inline: { ...styles.code_inline, ...selection },
    code_block: { ...styles.code_block, ...selection },
    fence: { ...styles.fence, ...selection },
  };
}
