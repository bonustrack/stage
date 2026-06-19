/** Settings → About route — app version / commit / build metadata as its own
 *  Settings sub-page. Reached via /settings → "About" row. */

import { AboutPage } from '../../components/system/AboutPage';

/** Settings → About screen: app version, commit, and build metadata. */
export default function SettingsAboutRoute(): React.ReactElement {
  return <AboutPage />;
}
