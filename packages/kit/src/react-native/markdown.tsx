import { useMemo } from 'react';
import { type TextStyle } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';
import { markdownStyles } from '../markdown.styles';
import { schemePalette } from '../tokens';

export interface MarkdownProps {
  value: string;
  streaming?: boolean;
  color?: string;
  linkColor?: string;
  dark?: boolean;
  style?: TextStyle;
}

export function Markdown(props: MarkdownProps): React.ReactElement {
  const { value, color, linkColor, dark = false, style } = props;
  const fg = color ?? schemePalette(dark).head;

  const styles = useMemo(() => {
    const base = markdownStyles({ fg, dark, link: linkColor });
    if (style) base.body = { ...base.body, ...style };
    return base;
  }, [fg, linkColor, dark, style]);

  return <RNMarkdown style={styles}>{value}</RNMarkdown>;
}
