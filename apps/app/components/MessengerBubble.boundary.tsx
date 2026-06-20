
import { Component } from 'react';

import type { ReactNode } from 'react';
import { Text } from '@stage-labs/kit/text';
import { Box } from './layout';

interface Props {
  children: ReactNode;
  sub: string;
}
interface State { failed: boolean }

export class BubbleErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.warn('MessengerBubble render failed; rendered fallback', error);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <Box padding={{ x: 16, y: 6 }}>
          <Text size="xs" color={this.props.sub} style={{ fontStyle: 'italic' }}>
            (this message could not be displayed)
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
