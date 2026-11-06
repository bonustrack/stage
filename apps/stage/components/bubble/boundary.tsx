import type { ReactNode } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import { Text } from '@stage-labs/kit/react-native/text';
import { bubbleFallbackText, bubbleFallbackShape } from './boundary.model';
import { Column, PAGE_GUTTER } from '../layout';
import { ResetBoundary } from '../chrome/ResetBoundary';

export function BubbleErrorBoundary({
  children,
  sub: fallbackColor,
  entry,
}: {
  children: ReactNode;
  sub: string;
  entry: HistoryEntry;
}): React.ReactElement {
  return (
    <ResetBoundary
      resetKey={entry}
      onError={(error) => {
        console.warn('MessengerBubble render failed; rendered fallback content', { id: entry.id, ...bubbleFallbackShape(entry) }, error);
      }}
      fallback={() => (
        <Column padding={{ x: PAGE_GUTTER, y: 6 }}>
          <Text size="sm" selectable color={fallbackColor} style={{ opacity: 0.85, lineHeight: 21 }}>
            {bubbleFallbackText(entry)}
          </Text>
        </Column>
      )}
    >
      {children}
    </ResetBoundary>
  );
}
