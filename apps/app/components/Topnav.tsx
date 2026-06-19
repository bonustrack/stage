/** @file The single canonical top bar shared across the four main tabs (Home / Wallet / Notifications / Profile), with configurable left/right slots and the shared TOPNAV_HEIGHT, meant to render outside the scrollable so it stays pinned. */

import { TopnavIdentity } from './TopnavIdentity';
import { Row } from './layout';
import { usePalette } from '../lib/theme';

/**
 * The single canonical topnav height (px), shared by ALL top bars so every one
 *  is pixel-identical: the four main-tab Topnav, the Home search bar, the
 *  conversation topnav and the conversation search bar. This is the full OUTER
 *  height including the 1px hairline bottom border, which is drawn INSIDE the box
 *  (RN/Yoga border-box) so it never adds to the total. Every path renders a
 *  fixed-height border-box of exactly this value (+ any top inset).
 */
export const TOPNAV_HEIGHT = 52;

/** Top navigation bar with configurable left and right slots. */
export function Topnav({ left, right }: {
  /** Left slot — defaults to the shared identity (avatar + name → Menu). */
  left?: React.ReactNode;
  /** Right slot — contextual per-tab actions (icons). Omitted = identity only. */
  right?: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Row
      height={TOPNAV_HEIGHT}
      padding={{ x: 16 }}
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
