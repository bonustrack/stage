/** Per-bubble error boundary for the conversation feed.
 *
 *  WHY: the conversation FlatList renders each message via MessengerBubble. React
 *  has no built-in per-item isolation, so if ONE bubble throws during render
 *  (e.g. a malformed/legacy poll body that slipped past the codec), the thrown
 *  error unmounts the entire FlatList subtree and the whole conversation comes up
 *  blank/stuck while the Home channel-list preview (a separate pure-string
 *  humanize path) keeps working. Wrapping each row in this boundary contains the
 *  blast radius to the single bad message: it renders a small inline fallback in
 *  place of that one bubble and the rest of the feed renders normally. */

import { Component } from 'react';

import type { ReactNode } from 'react';
import { Text } from '@metro-labs/kit/text';
import { Box } from './layout';

interface Props {
  children: ReactNode;
  /** Muted color for the fallback line (palette `sub`). */
  sub: string;
}
interface State { failed: boolean }

export class BubbleErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  /** Flags the boundary as failed when a child bubble throws during render. */
  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  /** Logs the caught render error without rethrowing so the feed stays alive. */
  componentDidCatch(error: unknown): void {
    // Log so a recurring bad message is diagnosable, but never rethrow.
    console.warn('MessengerBubble render failed; rendered fallback', error);
  }

  /** Renders the children, or an inline fallback line when a bubble has failed. */
  render(): ReactNode {
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
