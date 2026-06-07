/** Settings → Experimental route - groups the not-yet-stable surfaces (Kit
 *  gallery, app Components gallery, Developer diagnostics) under one page.
 *  Reached via /settings → "Experimental" row. */

import { ExperimentalSettings } from '../../components/settings/ExperimentalSettings';

export default function SettingsExperimentalRoute(): React.ReactElement {
  return <ExperimentalSettings />;
}
