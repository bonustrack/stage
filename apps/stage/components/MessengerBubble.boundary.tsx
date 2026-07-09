import { Component } from 'react';

import type { ReactNode } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { bubbleFallbackText, bubbleFallbackShape } from './MessengerBubble.boundary.model';

interface Props {
  children: ReactNode;
  sub: string;
  entry: HistoryEntry;
}
interface State { failed: boolean }

const LAST_RESORT = '(this message could not be displayed)';

export class BubbleErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.entry !== this.props.entry && this.state.failed) this.setState({ failed: false });
  }

  override componentDidCatch(error: unknown): void {
    const { entry } = this.props;
    console.warn(
      'MessengerBubble render failed; rendered fallback content',
      { id: entry.id, ...bubbleFallbackShape(entry) },
      error,
    );
  }

  private fallbackText(): string {
    try {
      return bubbleFallbackText(this.props.entry);
    } catch {
      return LAST_RESORT;
    }
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <Box padding={{ x: 16, y: 6 }}>
          <Text size="xl" selectable color={this.props.sub} style={{ opacity: 0.85, lineHeight: 21 }}>
            {this.fallbackText()}
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
