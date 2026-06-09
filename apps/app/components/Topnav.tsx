/** Topnav — the single canonical top bar shared across the four main tabs
 *  (Home / Wallet / Notifications / Profile). It owns the bar's structure and
 *  styling so every tab looks identical: a `toolbar`-surface Row, the standard
 *  horizontal/vertical padding, and a hairline bottom border separating it from
 *  the scrolling content below. Each tab supplies its own `left` (defaults to the
 *  shared TopnavIdentity avatar+name) and optional `right` contextual actions
 *  (search / requests / overflow on Home, none elsewhere).
 *
 *  STICKY: this bar is meant to render OUTSIDE the tab's scrollable (FlatList /
 *  ScrollView), so it stays pinned at the top while the page content scrolls
 *  underneath it. */

import { TopnavIdentity } from './TopnavIdentity';
import { Row } from './layout';
import { usePalette } from '../lib/theme';

export function Topnav({ left, right }: {
  /** Left slot — defaults to the shared identity (avatar + name → Menu). */
  left?: React.ReactNode;
  /** Right slot — contextual per-tab actions (icons). Omitted = identity only. */
  right?: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Row
      padding={{ x: 16, top: 12, bottom: 10 }}
      align="center"
      justify="between"
      surface="toolbar"
      style={{ borderBottomWidth: 1, borderBottomColor: border }}
    >
      <Row align="center" gap={8}>
        {left ?? <TopnavIdentity/>}
      </Row>
      {right ? (
        <Row align="center" gap={18}>
          {right}
        </Row>
      ) : null}
    </Row>
  );
}
