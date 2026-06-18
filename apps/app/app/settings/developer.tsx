/** Settings → Developer route - device-local diagnostic toggles (Railgun debug
 *  console). Reached via /settings → "Developer" row. */

import { DeveloperSettings } from '../../components/settings/DeveloperSettings';

/** Settings → Developer screen: device-local diagnostic toggles. */
export default function SettingsDeveloperRoute(): React.ReactElement {
  return <DeveloperSettings />;
}
