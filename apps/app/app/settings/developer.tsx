/** Settings → Developer route - device-local diagnostic toggles (Railgun debug
 *  console). Reached via /settings → "Developer" row. */

import { DeveloperSettings } from '../../components/settings/DeveloperSettings';

export default function SettingsDeveloperRoute(): React.ReactElement {
  return <DeveloperSettings />;
}
