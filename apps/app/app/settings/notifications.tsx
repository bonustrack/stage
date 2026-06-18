/** Settings → Notifications route — enable / disable push notifications.
 *  Reached via /settings → "Notifications" row. */

import { NotificationsSettings } from '../../components/settings/NotificationsSettings';

/** Settings → Notifications screen: enable / disable push notifications. */
export default function SettingsNotificationsRoute(): React.ReactElement {
  return <NotificationsSettings />;
}
