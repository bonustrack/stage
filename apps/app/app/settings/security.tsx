/** @file Settings → Security route for exporting the private key and removing the account. */

import { SecuritySettings } from '../../components/settings/SecuritySettings';

/** Settings → Security screen: export private key + remove account. */
export default function SettingsSecurityRoute(): React.ReactElement {
  return <SecuritySettings />;
}
