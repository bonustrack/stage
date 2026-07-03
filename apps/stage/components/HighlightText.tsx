
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import { FONT_SIZE } from '@stage-labs/kit/tokens';
import { basicRoot, highlightText } from '@stage-labs/views';

export function HighlightText({ text, query, fg }: {
  text: string;
  query: string;
  fg: string;
}): React.ReactElement {
  const node = basicRoot(
    highlightText({ text, query: query.trim(), color: fg, fontSize: FONT_SIZE['3xl'], lineHeight: 23 }),
  );
  return <ViewHost node={node} />;
}
