import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { highlightSegments } from '../HighlightText.model';
import { HIGHLIGHT_BG } from '../../lib/uiColors';
import { Row } from '../layout';
import { MessageText } from './MessageText';

export function HighlightText({ text, query, fg }: { text: string; query: string; fg: string }): React.ReactElement {
  const scheme = useKitScheme();
  const segments = highlightSegments(text, query.trim());
  return (
    <Row wrap align="baseline">
      {segments.map((segment, index) => (
        <MessageText
          key={`${index}-${segment.value}`}
          text={segment.value}
          color={fg}
          style={{ minWidth: 0, ...(segment.match ? { backgroundColor: HIGHLIGHT_BG[scheme] } : {}) }}
        />
      ))}
    </Row>
  );
}
