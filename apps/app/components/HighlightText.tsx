
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type { WidgetRoot } from '@stage-labs/kit/chatkit';
import { highlightText } from '@stage-labs/views';

export function HighlightText({ text, query, fg }: {
  text: string;
  query: string;
  fg: string;
}): React.ReactElement {
  const node: WidgetRoot = {
    type: 'Basic',
    children: [
      highlightText({ text, query: query.trim(), color: fg, matchColor: 'warning', size: 'xl' }),
    ],
  };
  return <ChatKitRenderer node={node} />;
}
