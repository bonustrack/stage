
import { MarkdownIt } from 'react-native-markdown-display';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';

export const mdParser = MarkdownIt({ typographer: false, linkify: true, breaks: true });

registerDeepLinkSchemas(mdParser.linkify);
