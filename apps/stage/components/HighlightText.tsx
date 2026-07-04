
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { highlightSegments } from './HighlightText.model';
import { HIGHLIGHT_BG } from '../lib/uiColors';
import { Row } from './layout';

export function HighlightText({ text, query, fg }: {
  text: string;
  query: string;
  fg: string;
}): React.ReactElement {
  const scheme = useKitScheme();
  const segments = highlightSegments(text, query.trim());
  return (
    <Row wrap align="baseline">
      {segments.map((segment, index) => (
        <Text
          key={`${index}-${segment.value}`}
          value={segment.value}
          color={fg}
          size="3xl"
          style={{
            lineHeight: 23,
            ...(segment.match ? { backgroundColor: HIGHLIGHT_BG[scheme] } : {}),
          }}
        />
      ))}
    </Row>
  );
}
