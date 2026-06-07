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

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // Log so a recurring bad message is diagnosable, but never rethrow.
    console.warn('MessengerBubble render failed; rendered fallback', error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <Box style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          <Text style={{ color: this.props.sub, fontSize: 13, fontStyle: 'italic', fontFamily: 'Calibre-Medium' }}>
            (this message could not be displayed)
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
