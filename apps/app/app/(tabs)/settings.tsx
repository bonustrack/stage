/** Settings route — NO LONGER in the bottom tab bar (hidden via `href: null` in
 *  `_layout.tsx`) and NO LONGER in the swipe pager strip. Reached only from the
 *  LeftDrawer's Settings row. Now a System-style menu whose rows push their own
 *  sub-pages (/settings/display, /settings/messenger, /settings/security). */

import { SettingsMenu } from '../../components/settings/SettingsMenu';

/** Settings tab route rendering the top-level settings menu. */
export default function SettingsRoute(): React.ReactElement {
  return <SettingsMenu />;
}
