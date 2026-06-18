/** Route placeholder — the actual screen body is rendered by the shared
 *  horizontal pager in `_layout.tsx` (all four tab bodies mounted side-by-side
 *  so swiping reveals the neighbour as it follows the finger). This file exists
 *  only so expo-router keeps a real route per tab — deep links to `/wallet`
 *  etc. resolve, the URL stays correct, and the bottom tab-bar highlight is
 *  router-driven. It renders nothing (the pager overlays the scene). */

/** Empty Messenger route stub kept so expo-router resolves the index tab. */
export default function TabRoutePlaceholder(): null {
  return null;
}
