
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { highlightSegments } from './HighlightText.model';
import { HIGHLIGHT_BG } from '../lib/uiColors';
import { Row } from './layout';

export function HighlightText({ text, query, fg, inline }: {
  text: string;
  query: string;
  fg: string;
  inline?: boolean;
}): React.ReactElement {
  const scheme = useKitScheme();
  const segments = highlightSegments(text, query.trim());
  const parts = segments.map((segment, index) => (
    <Text
      key={`${index}-${segment.value}`}
      value={segment.value}
      color={fg}
      size="3xl"
      style={{
        lineHeight: 23,
        minWidth: 0,
        ...(segment.match ? { backgroundColor: HIGHLIGHT_BG[scheme] } : {}),
      }}
    />
  ));
  return inline ? <Text size="3xl" color={fg}>{parts}</Text> : <Row wrap align="baseline">{parts}</Row>;
}
