/** Settings → Notifications route — enable / disable push notifications.
 *  Reached via /settings → "Notifications" row. */

import { NotificationsSettings } from '../../components/settings/NotificationsSettings';

export default function SettingsNotificationsRoute(): React.ReactElement {
  return <NotificationsSettings />;
}
