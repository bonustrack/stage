/** @file Per-bubble error boundary for the conversation feed: confines a throwing message to a small inline fallback so one malformed bubble can't unmount the whole FlatList subtree. */

import { Component } from 'react';

import type { ReactNode } from 'react';
import { Text } from '@stage-labs/kit/text';
import { Box } from './layout';

interface Props {
  children: ReactNode;
  /** Muted color for the fallback line (palette `sub`). */
  sub: string;
}
interface State { failed: boolean }

export class BubbleErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  /** Flags the boundary as failed when a child bubble throws during render. */
  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  /** Logs the caught render error without rethrowing so the feed stays alive. */
  override componentDidCatch(error: unknown): void {
    /** Log so a recurring bad message is diagnosable, but never rethrow. */
    console.warn('MessengerBubble render failed; rendered fallback', error);
  }

  /** Renders the children, or an inline fallback line when a bubble has failed. */
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
