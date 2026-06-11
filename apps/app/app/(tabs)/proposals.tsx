/** Route placeholder — the Proposals body is the 2nd page of the shared
 *  horizontal pager in `_layout.tsx` (mounted side-by-side with the other tab
 *  bodies so swiping reveals it as it follows the finger). This file exists only
 *  so expo-router keeps a real `/proposals` route — deep links resolve, the URL
 *  stays correct, and the bottom tab-bar highlight is router-driven. It renders
 *  nothing (the pager overlays the scene). */

export default function TabRoutePlaceholder(): null {
  return null;
}
